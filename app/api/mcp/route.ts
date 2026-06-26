/**
 * app/api/mcp/route.ts
 *
 * MCP (Model Context Protocol) server — Streamable HTTP transport.
 * Exposes Simplifi coordinator skills as tools for Claude Cowork.
 *
 * Protocol: JSON-RPC 2.0 over POST. Handles:
 *   initialize            → server capabilities
 *   notifications/*       → no-op (acknowledged)
 *   tools/list            → list available tools
 *   tools/call            → execute a tool
 *
 * Each coordinator has a unique skill_api_key stored in their users row.
 * The incoming Bearer token is threaded through to every internal app API call
 * so each coordinator's identity propagates correctly — one connector URL works
 * for every coordinator.
 *
 * Connect in claude.ai → Settings → Integrations → add this route's URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ── Helpers ───────────────────────────────────────────────────────────────────

const APP_URL    = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const SB_URL     = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function appHeaders(authKey: string) {
  return { Authorization: authKey, 'Content-Type': 'application/json' };
}

async function appGet(path: string, authKey: string): Promise<unknown> {
  const res = await fetch(`${APP_URL}${path}`, { headers: appHeaders(authKey), cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function appPost(path: string, body: unknown, authKey: string): Promise<unknown> {
  const res = await fetch(`${APP_URL}${path}`, {
    method: 'POST', headers: appHeaders(authKey), body: JSON.stringify(body), cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function sbGet(table: string, qs: string): Promise<unknown[]> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: SB_SVC_KEY, Authorization: `Bearer ${SB_SVC_KEY}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<unknown[]>;
}

async function sbInsert(table: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SB_SVC_KEY,
      Authorization: `Bearer ${SB_SVC_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
}

function textContent(text: string) {
  return { content: [{ type: 'text', text }] };
}

function errorContent(text: string) {
  return { isError: true, content: [{ type: 'text', text }] };
}

// ── Tool registry ─────────────────────────────────────────────────────────────

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  run: (args: Record<string, unknown>, authKey: string) => Promise<{ isError?: boolean; content: { type: string; text: string }[] }>;
}

function tool<S extends z.ZodRawShape>(
  name: string,
  description: string,
  shape: S,
  run: (args: z.infer<z.ZodObject<S>>, authKey: string) => Promise<{ isError?: boolean; content: { type: string; text: string }[] }>,
): Tool {
  const schema = z.object(shape);
  // Zod v4 built-in JSON Schema export
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  return {
    name,
    description,
    inputSchema: jsonSchema,
    run: async (args, authKey) => {
      const parsed = schema.safeParse(args);
      if (!parsed.success) return errorContent(`Invalid arguments: ${parsed.error.message}`);
      return run(parsed.data as z.infer<z.ZodObject<S>>, authKey);
    },
  };
}

// ── Tools ─────────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [

  tool('show_requests', "List the coordinator's tutoring requests. Returns full request data including student_email and requested_schedule so send_proposal can be called directly from the results.",
    { status: z.enum(['open', 'all']).default('open').describe('open = only unmatched; all = every request') },
    async ({ status }, authKey) => {
      const rows = await appGet('/api/requests', authKey) as Record<string, unknown>[];
      const filtered = status === 'open' ? rows.filter(r => r.status === 'open') : rows;
      // Return all fields needed for send_proposal — do not strip student_email or requested_schedule
      const summary = filtered.map(r => ({
        id:                 r.id,
        student_name:       r.student_name,
        student_email:      r.student_email ?? null,
        subject:            r.subject ?? null,
        status:             r.status,
        timezone:           r.timezone ?? null,
        start_date:         r.start_date ?? null,
        offered_rate:       r.offered_rate ?? null,
        requested_schedule: r.requested_schedule ?? [],
        asana_task_id:      r.asana_task_id ?? null,
        notes:              r.notes ?? null,
      }));
      return textContent(JSON.stringify({ count: summary.length, requests: summary }, null, 2));
    }),

  tool('list_tutors', 'List active tutors with name and email. Use to resolve a name to an email before calling send_proposal.',
    {},
    async (_args, _authKey) => {
      const tutors = await sbGet('users', 'role=eq.TUTOR&status=eq.ACTIVE&select=name,email&order=name.asc');
      return textContent(JSON.stringify(tutors, null, 2));
    }),

  tool('send_proposal', 'Send a tutoring job proposal to a tutor. Prefer passing request_id (from show_requests) and the tool will look up all student details automatically. Only pass the other fields if you do not have a request_id.',
    {
      tutor_email:   z.string().describe("Tutor's email. Use list_tutors if you only have their name."),
      request_id:    z.string().optional().describe('ID from show_requests — if provided, all student fields are pulled from the request automatically'),
      student_name:  z.string().optional(),
      student_email: z.string().optional(),
      subject:       z.string().optional(),
      schedule: z.array(z.object({
        day:   z.number().describe('0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat'),
        start: z.number().describe('Start hour 0–23'),
        end:   z.number().describe('End hour 0–23'),
      })).optional(),
      timezone:      z.string().optional().describe('IANA timezone'),
      start_date:    z.string().optional().describe('YYYY-MM-DD'),
      notes:         z.string().optional(),
      offered_rate:  z.number().optional(),
    },
    async ({ tutor_email, request_id, student_name, student_email, subject, schedule, timezone,
             start_date, notes, offered_rate }, authKey) => {
      // Look up tutor
      const tutors = await sbGet(
        'users',
        `email=eq.${encodeURIComponent(tutor_email)}&role=eq.TUTOR&status=eq.ACTIVE&select=id,name&limit=1`,
      ) as { id: string; name: string }[];
      if (!tutors.length) return errorContent(`No active tutor found for ${tutor_email}. Use list_tutors to find the correct email.`);

      // If request_id provided, pull all fields from the request record
      if (request_id) {
        const reqs = await sbGet(
          'requests',
          `id=eq.${request_id}&select=student_name,student_email,subject,requested_schedule,timezone,start_date,notes,offered_rate,asana_task_id&limit=1`,
        ) as Record<string, unknown>[];
        if (!reqs.length) return errorContent(`Request ${request_id} not found.`);
        const req = reqs[0];
        await appPost('/api/proposals', {
          tutor_id:           tutors[0].id,
          student_name:       req.student_name,
          student_email:      req.student_email,
          subject:            req.subject,
          requested_schedule: req.requested_schedule,
          timezone:           req.timezone,
          start_date:         req.start_date,
          notes:              req.notes,
          offered_rate:       req.offered_rate,
          asana_task_id:      req.asana_task_id,
        }, authKey);
        return textContent(`Proposal sent to ${tutors[0].name} (${tutor_email}) — ${req.student_name}, ${req.subject}.`);
      }

      // Manual fields path
      if (!student_name || !student_email || !subject || !schedule || !timezone) {
        return errorContent('Provide either request_id or all of: student_name, student_email, subject, schedule, timezone.');
      }
      await appPost('/api/proposals', {
        tutor_id: tutors[0].id, student_name, student_email, subject,
        requested_schedule: schedule, timezone, start_date, notes, offered_rate,
      }, authKey);
      return textContent(`Proposal sent to ${tutors[0].name} (${tutor_email}) — ${student_name}, ${subject}.`);
    }),

  tool('create_request', 'Log a new tutoring request from an intake call or transcript. One call per subject.',
    {
      student_name:  z.string(),
      student_email: z.string().optional(),
      subject:       z.string().optional(),
      schedule: z.array(z.object({
        day: z.number(), start: z.number(), end: z.number(),
      })).optional(),
      timezone:     z.string().optional(),
      start_date:   z.string().optional().describe('YYYY-MM-DD'),
      notes:        z.string().optional(),
      offered_rate: z.number().optional(),
      asana_task_id:  z.string().optional().describe('{gid}::{subject_slug} for idempotent upsert'),
      asana_task_url: z.string().optional(),
    },
    async ({ student_name, student_email, subject, schedule, timezone,
             start_date, notes, offered_rate, asana_task_id, asana_task_url }, authKey) => {
      const result = await appPost('/api/requests', {
        student_name, student_email, subject, requested_schedule: schedule,
        timezone, start_date, notes, offered_rate, asana_task_id, asana_task_url,
      }, authKey) as { id: string };
      return textContent(`Request created for ${student_name}${subject ? ` — ${subject}` : ''}. (id: ${result.id})`);
    }),

  tool('show_availability', "Show every active tutor's working hours and calendar busy blocks for the current and next week.",
    { timezone: z.string().default('America/New_York') },
    async ({ timezone }, authKey) => {
      const tutors = await sbGet(
        'users', 'role=eq.TUTOR&status=eq.ACTIVE&select=id,name,availability&order=name.asc',
      ) as { id: string; name: string; availability: unknown }[];

      if (!tutors.length) return textContent('No active tutors found.');

      const tutorIds = tutors.map(t => t.id);
      const [week0, week1] = await Promise.all([
        appPost('/api/nylas/weekly-busy', { tutorIds, weekOffset: 0, tz: timezone }, authKey),
        appPost('/api/nylas/weekly-busy', { tutorIds, weekOffset: 1, tz: timezone }, authKey),
      ]) as [{ busySlots: Record<string, unknown[]> }, { busySlots: Record<string, unknown[]> }];

      const result = tutors.map(t => ({
        name:         t.name,
        workingHours: t.availability ?? {},
        busyThisWeek: week0.busySlots?.[t.id] ?? [],
        busyNextWeek: week1.busySlots?.[t.id] ?? [],
      }));

      return textContent(JSON.stringify({ timezone, tutors: result }, null, 2));
    }),

  tool('sync_requests',
    `Fetch all incomplete tasks from the "New Tutoring Request" section of the coordinator's Asana project, plus the app's subject list.

After calling this tool, for each task:
1. Extract ALL subjects from the notes ("Subjects:" line) — one create_request call per subject.
2. Match each subject against the returned subjects list (case-insensitive, partial ok; null + append to notes if no match).
3. Parse schedule from notes:
   - "evenings and weekends" → Mon–Fri day 1-5 start:18 end:23, Sat–Sun day 6,0 start:8 end:23
   - "evenings" → all 7 days start:18 end:23  |  "weekdays" → Mon–Fri start:8 end:23
   - "morning"=8–12, "afternoon"=13–18, "evening"=18–23
4. Infer timezone: MSK→Europe/Moscow, ET→America/New_York, PT→America/Los_Angeles, CT→America/Chicago.
5. Set asana_task_id to "{gid}::{subject_lowercase_underscored}" (makes it idempotent — safe to run twice).`,
    {},
    async (_args, authKey) => {
      const profile = await appGet('/api/coordinator/profile', authKey) as { id: string; asana_project_id: string | null };
      if (!profile.asana_project_id) return errorContent('No Asana project connected. Go to app Settings → Asana to connect your project.');

      const coordRows = await sbGet('users', `id=eq.${profile.id}&select=asana_access_token&limit=1`) as { asana_access_token: string | null }[];
      const token = coordRows[0]?.asana_access_token;
      if (!token) return errorContent('No Asana access token stored. Go to app Settings → Asana to reconnect.');

      const asanaGet = async (path: string) => {
        const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Asana ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return (await res.json() as { data: unknown }).data;
      };

      const sections = await asanaGet(`/projects/${profile.asana_project_id}/sections?opt_fields=gid,name`) as { gid: string; name: string }[];
      const section = sections.find(s => /new.?tutoring.?request/i.test(s.name));
      if (!section) return errorContent(`No "New Tutoring Request" section found. Sections: ${sections.map(s => s.name).join(', ')}`);

      const tasks = await asanaGet(`/sections/${section.gid}/tasks?opt_fields=gid,name,notes,due_on,permalink_url&completed_since=now`) as { gid: string; name: string; notes: string; due_on: string | null; permalink_url: string }[];
      const subjects = await appGet('/api/subjects', authKey) as { name: string }[];

      return textContent(JSON.stringify({
        task_count: tasks.length,
        subjects: subjects.map(s => s.name),
        tasks: tasks.map(t => ({ gid: t.gid, name: t.name, notes: t.notes, due_on: t.due_on, permalink_url: t.permalink_url })),
      }, null, 2));
    }),

  tool('leave_feedback', 'Leave a comment or note for Austin to review. Use this any time something works well, something is confusing, a skill gives a wrong result, or you have a feature request.',
    {
      message:  z.string().describe('Your feedback, bug report, or feature request'),
      context:  z.string().optional().describe('Which skill or task you were doing when you hit this (e.g. "send_proposal", "sync_requests")'),
    },
    async ({ message, context }, authKey) => {
      // Identify who is leaving feedback via the skill API key
      let coordinator_name: string | null = null;
      try {
        const profile = await appGet('/api/coordinator/profile', authKey) as { name?: string };
        coordinator_name = profile.name ?? null;
      } catch {
        // non-fatal — store without name
      }

      await sbInsert('skill_feedback', {
        message,
        context: context ?? null,
        coordinator_name,
        created_at: new Date().toISOString(),
      });

      return textContent(`Got it${coordinator_name ? `, ${coordinator_name}` : ''}. Feedback saved — Austin will review it when he's back.`);
    }),

  tool('show_feedback', "Show all stored skill feedback. Austin uses this to review comments left by coordinators.",
    {
      limit: z.number().default(50).describe('Max number of entries to return (newest first)'),
    },
    async ({ limit }, _authKey) => {
      const rows = await sbGet(
        'skill_feedback',
        `order=created_at.desc&limit=${limit}&select=message,context,coordinator_name,created_at`,
      );
      if (!rows.length) return textContent('No feedback yet.');
      return textContent(JSON.stringify(rows, null, 2));
    }),

  tool('dashboard', 'Full coordinator dashboard — open requests, pending proposals, active jobs, team capacity, stalled requests, pending reviews, availability requests. All in one call.',
    {},
    async (_args, authKey) => {
      const profile = await appGet('/api/coordinator/profile', authKey) as { id: string };
      const uid = profile.id;
      const cutoff48h = new Date(Date.now() - 48 * 3600_000).toISOString();
      const [openReqs, pendingProps, activeJobs, tutors, pendingSubjects, availReqs] = await Promise.all([
        sbGet('requests', `status=eq.open&coordinator_id=eq.${uid}&select=id,student_name,subject,source,created_at`),
        sbGet('proposals', `status=eq.PENDING&coordinator_id=eq.${uid}&select=id,tutor_id,student_name,subject,expires_at`),
        sbGet('proposals', `status=eq.ACCEPTED&coordinator_id=eq.${uid}&select=id,tutor_id,student_name,subject`),
        sbGet('users', 'role=eq.TUTOR&status=eq.ACTIVE&select=id,name,max_weekly_hours,nylas_grant_id'),
        sbGet('tutor_subject_changes', 'status=eq.PENDING&select=id,tutor_id,subject_id,change_type'),
        sbGet('tutor_availability_requests', 'status=eq.PENDING&select=id,tutor_id,request_type,reason'),
      ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], unknown[], unknown[]];
      const stalled = openReqs.filter(r => (r.created_at as string) <= cutoff48h);
      const tutorNames = new Map((tutors as { id: string; name: string }[]).map(t => [t.id, t.name]));
      return textContent(JSON.stringify({
        open_requests: openReqs.length,
        pending_proposals: pendingProps.length,
        active_jobs: activeJobs.length,
        team_size: tutors.length,
        connected_tutors: tutors.filter((t: Record<string, unknown>) => t.nylas_grant_id).length,
        stalled_requests: stalled.map(r => ({ student_name: r.student_name, subject: r.subject, source: r.source, created_at: r.created_at })),
        pending_proposals_detail: pendingProps.map(p => ({ student_name: p.student_name, subject: p.subject, tutor: tutorNames.get(p.tutor_id as string) ?? p.tutor_id, expires_at: p.expires_at })),
        active_jobs_detail: activeJobs.map(j => ({ student_name: j.student_name, subject: j.subject, tutor: tutorNames.get(j.tutor_id as string) ?? j.tutor_id })),
        pending_subject_reviews: pendingSubjects.length,
        pending_availability_requests: availReqs.length,
      }, null, 2));
    }),

  tool('pending_proposals', 'List all pending proposals awaiting tutor response.',
    {},
    async (_args, _authKey) => {
      const props = await sbGet('proposals', 'status=eq.PENDING&select=id,tutor_id,student_name,subject,created_at,expires_at&order=created_at') as Record<string, unknown>[];
      const tutors = await sbGet('users', 'role=eq.TUTOR&select=id,name') as { id: string; name: string }[];
      const nameMap = new Map(tutors.map(t => [t.id, t.name]));
      const result = props.map(p => ({
        student_name: p.student_name, subject: p.subject,
        tutor: nameMap.get(p.tutor_id as string) ?? p.tutor_id,
        created_at: p.created_at, expires_at: p.expires_at,
      }));
      return textContent(JSON.stringify({ count: result.length, proposals: result }, null, 2));
    }),

  tool('tutor_capacity', 'Show capacity for all active tutors — active jobs count, max hours, calendar connection.',
    {},
    async (_args, _authKey) => {
      const [tutors, jobs] = await Promise.all([
        sbGet('users', 'role=eq.TUTOR&status=eq.ACTIVE&select=id,name,max_weekly_hours,nylas_grant_id&order=name'),
        sbGet('proposals', 'status=eq.ACCEPTED&select=tutor_id'),
      ]) as [Record<string, unknown>[], { tutor_id: string }[]];
      const jobCounts = new Map<string, number>();
      for (const j of jobs) jobCounts.set(j.tutor_id, (jobCounts.get(j.tutor_id) ?? 0) + 1);
      const result = (tutors as { id: string; name: string; max_weekly_hours: number; nylas_grant_id: string | null }[]).map(t => ({
        name: t.name, active_jobs: jobCounts.get(t.id) ?? 0,
        max_weekly_hours: t.max_weekly_hours, calendar_connected: !!t.nylas_grant_id,
      }));
      const avg = result.length > 0 ? +(result.reduce((s, t) => s + t.active_jobs, 0) / result.length).toFixed(1) : 0;
      return textContent(JSON.stringify({ tutor_count: result.length, avg_active_jobs: avg, tutors: result }, null, 2));
    }),

  tool('capacity', 'Show capacity for a specific tutor by name or email.',
    { tutor: z.string().describe('Tutor name or email') },
    async ({ tutor: query }, _authKey) => {
      const isEmail = query.includes('@');
      const qs = isEmail
        ? `email=eq.${encodeURIComponent(query)}&role=eq.TUTOR&select=id,name,email,max_weekly_hours,nylas_grant_id,status`
        : `name=ilike.*${encodeURIComponent(query)}*&role=eq.TUTOR&select=id,name,email,max_weekly_hours,nylas_grant_id,status`;
      const tutors = await sbGet('users', qs) as Record<string, unknown>[];
      if (!tutors.length) return errorContent(`No tutor found matching "${query}".`);
      const t = tutors[0] as { id: string; name: string; email: string; max_weekly_hours: number; nylas_grant_id: string | null; status: string };
      const [active, pending] = await Promise.all([
        sbGet('proposals', `tutor_id=eq.${t.id}&status=eq.ACCEPTED&select=student_name,subject`),
        sbGet('proposals', `tutor_id=eq.${t.id}&status=eq.PENDING&select=student_name,subject`),
      ]);
      return textContent(JSON.stringify({
        name: t.name, email: t.email, status: t.status,
        max_weekly_hours: t.max_weekly_hours, calendar_connected: !!t.nylas_grant_id,
        active_jobs: active, pending_proposals: pending,
      }, null, 2));
    }),

  tool('needs_attention', 'List open requests older than 48 hours that have not been matched.',
    {},
    async (_args, _authKey) => {
      const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
      const rows = await sbGet('requests', `status=eq.open&created_at=lte.${cutoff}&select=student_name,subject,source,created_at&order=created_at`) as Record<string, unknown>[];
      return textContent(JSON.stringify({ count: rows.length, requests: rows }, null, 2));
    }),

  tool('response_times', 'Show the tutor response time leaderboard (last 90 days).',
    {},
    async (_args, _authKey) => {
      const window = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const [resolved, tutors] = await Promise.all([
        sbGet('proposals', `status=in.(ACCEPTED,DECLINED,EXPIRED)&resolved_at=not.is.null&created_at=gte.${window}&select=tutor_id,created_at,resolved_at`),
        sbGet('users', 'role=eq.TUTOR&select=id,name'),
      ]) as [{ tutor_id: string; created_at: string; resolved_at: string }[], { id: string; name: string }[]];
      const nameMap = new Map(tutors.map(t => [t.id, t.name]));
      const totals = new Map<string, { totalMs: number; count: number }>();
      for (const r of resolved) {
        const ms = new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime();
        const prev = totals.get(r.tutor_id) ?? { totalMs: 0, count: 0 };
        totals.set(r.tutor_id, { totalMs: prev.totalMs + ms, count: prev.count + 1 });
      }
      const entries = [...totals.entries()].map(([id, { totalMs, count }]) => ({
        tutor: nameMap.get(id) ?? id, avg_hours: +(totalMs / count / 3_600_000).toFixed(1), proposals: count,
      })).sort((a, b) => a.avg_hours - b.avg_hours);
      return textContent(JSON.stringify({ tutor_count: entries.length, leaderboard: entries }, null, 2));
    }),

  tool('pending_subjects', 'List all pending tutor subject change requests awaiting approval.',
    {},
    async (_args, _authKey) => {
      const [changes, tutors, subjects] = await Promise.all([
        sbGet('tutor_subject_changes', 'status=eq.PENDING&select=id,tutor_id,subject_id,change_type,requested_confidence,requested_note&order=created_at'),
        sbGet('users', 'role=eq.TUTOR&select=id,name'),
        sbGet('subjects', 'select=id,name'),
      ]) as [Record<string, unknown>[], { id: string; name: string }[], { id: string; name: string }[]];
      const tutorMap = new Map(tutors.map(t => [t.id, t.name]));
      const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
      const result = changes.map(c => ({
        tutor: tutorMap.get(c.tutor_id as string) ?? c.tutor_id,
        subject: subjectMap.get(c.subject_id as string) ?? c.subject_id,
        change_type: c.change_type, requested_confidence: c.requested_confidence,
        note: c.requested_note,
      }));
      return textContent(JSON.stringify({ count: result.length, reviews: result }, null, 2));
    }),

  tool('availability_requests', 'List all pending tutor availability change requests (pause, low hours, low windows).',
    {},
    async (_args, _authKey) => {
      const [reqs, tutors] = await Promise.all([
        sbGet('tutor_availability_requests', 'status=eq.PENDING&select=id,tutor_id,request_type,reason,details&order=created_at'),
        sbGet('users', 'role=eq.TUTOR&select=id,name'),
      ]) as [Record<string, unknown>[], { id: string; name: string }[]];
      const tutorMap = new Map(tutors.map(t => [t.id, t.name]));
      const result = reqs.map(r => ({
        tutor: tutorMap.get(r.tutor_id as string) ?? r.tutor_id,
        request_type: r.request_type, reason: r.reason, details: r.details,
      }));
      return textContent(JSON.stringify({ count: result.length, requests: result }, null, 2));
    }),

];

// ── MCP protocol handler ──────────────────────────────────────────────────────

const TOOL_MAP = new Map(TOOLS.map(t => [t.name, t]));

function mcpError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleMessage(msg: Record<string, unknown>, authKey: string) {
  const { method, id, params } = msg as { method: string; id: unknown; params?: Record<string, unknown> };

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'simplifi-edu', version: '1.0.0' },
      },
    };
  }

  if (method?.startsWith('notifications/')) {
    return null; // acknowledged, no response needed
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0', id,
      result: {
        tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      },
    };
  }

  if (method === 'tools/call') {
    const toolName = params?.name as string;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;
    const t = TOOL_MAP.get(toolName);
    if (!t) return mcpError(id, -32601, `Unknown tool: ${toolName}`);

    try {
      const result = await t.run(args, authKey);
      return { jsonrpc: '2.0', id, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { jsonrpc: '2.0', id, result: errorContent(`Tool error: ${message}`) };
    }
  }

  return mcpError(id, -32601, `Method not found: ${method}`);
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ ok: true, server: 'simplifi-edu-mcp' });
}

export async function POST(req: NextRequest) {
  // Accept the coordinator's key either as an Authorization header (preferred)
  // or as a ?key= query parameter (for clients like claude.ai that don't support
  // custom headers — paste the full URL with ?key=sk_coord_... as the connector URL).
  const headerKey = req.headers.get('authorization') ?? '';
  const urlKey    = req.nextUrl.searchParams.get('key');
  const authKey   = headerKey || (urlKey ? `Bearer ${urlKey}` : '');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(mcpError(null, -32700, 'Parse error'), { status: 400 });
  }

  // Handle batch or single message
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(msg => handleMessage(msg as Record<string, unknown>, authKey)))).filter(Boolean);
    return NextResponse.json(responses);
  }

  const response = await handleMessage(body as Record<string, unknown>, authKey);
  if (response === null) return new NextResponse(null, { status: 202 }); // notification acknowledged
  return NextResponse.json(response);
}
