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
 * Connect in claude.ai → Settings → Integrations → add this route's URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ── Helpers ───────────────────────────────────────────────────────────────────

const APP_URL      = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const SB_URL       = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SB_SVC_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SKILL_KEY    = process.env.SKILL_API_KEY ?? '';

function appHeaders() {
  return { Authorization: `Bearer ${SKILL_KEY}`, 'Content-Type': 'application/json' };
}

async function appGet(path: string): Promise<unknown> {
  const res = await fetch(`${APP_URL}${path}`, { headers: appHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function appPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${APP_URL}${path}`, {
    method: 'POST', headers: appHeaders(), body: JSON.stringify(body), cache: 'no-store',
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
  run: (args: Record<string, unknown>) => Promise<{ isError?: boolean; content: { type: string; text: string }[] }>;
}

function tool<S extends z.ZodRawShape>(
  name: string,
  description: string,
  shape: S,
  run: (args: z.infer<z.ZodObject<S>>) => Promise<{ isError?: boolean; content: { type: string; text: string }[] }>,
): Tool {
  const schema = z.object(shape);
  // Zod v4 built-in JSON Schema export
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  return {
    name,
    description,
    inputSchema: jsonSchema,
    run: async (args) => {
      const parsed = schema.safeParse(args);
      if (!parsed.success) return errorContent(`Invalid arguments: ${parsed.error.message}`);
      return run(parsed.data as z.infer<z.ZodObject<S>>);
    },
  };
}

// ── Tools ─────────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [

  tool('show_requests', "List the coordinator's tutoring requests.",
    { status: z.enum(['open', 'all']).default('open').describe('open = only unmatched; all = every request') },
    async ({ status }) => {
      const rows = await appGet('/api/requests') as Record<string, unknown>[];
      const filtered = status === 'open' ? rows.filter(r => r.status === 'open') : rows;
      const summary = filtered.map(r => ({
        id:           r.id,
        student:      r.student_name,
        subject:      r.subject ?? '—',
        status:       r.status,
        timezone:     r.timezone ?? '—',
        start_date:   r.start_date ?? '—',
        offered_rate: r.offered_rate ? `$${r.offered_rate}/hr` : '—',
        notes:        typeof r.notes === 'string' ? r.notes.slice(0, 120) : '',
      }));
      return textContent(JSON.stringify({ count: summary.length, requests: summary }, null, 2));
    }),

  tool('list_tutors', 'List active tutors with name and email. Use to resolve a name to an email before calling send_proposal.',
    {},
    async () => {
      const tutors = await sbGet('users', 'role=eq.TUTOR&status=eq.ACTIVE&select=name,email&order=name.asc');
      return textContent(JSON.stringify(tutors, null, 2));
    }),

  tool('send_proposal', 'Send a tutoring job proposal to a tutor. Pass all schedule/timezone/notes from the request record directly.',
    {
      tutor_email:   z.string().describe("Tutor's email. Use list_tutors if you only have their name."),
      student_name:  z.string(),
      student_email: z.string(),
      subject:       z.string(),
      schedule: z.array(z.object({
        day:   z.number().describe('0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat'),
        start: z.number().describe('Start hour 0–23'),
        end:   z.number().describe('End hour 0–23'),
      })),
      timezone:      z.string().describe('IANA timezone'),
      start_date:    z.string().optional().describe('YYYY-MM-DD'),
      notes:         z.string().optional().describe('Full notes from the request record'),
      offered_rate:  z.number().optional().describe('Hourly rate in dollars'),
      asana_task_id: z.string().optional(),
    },
    async ({ tutor_email, student_name, student_email, subject, schedule, timezone,
             start_date, notes, offered_rate, asana_task_id }) => {
      const tutors = await sbGet(
        'users',
        `email=eq.${encodeURIComponent(tutor_email)}&role=eq.TUTOR&status=eq.ACTIVE&select=id,name&limit=1`,
      ) as { id: string; name: string }[];

      if (!tutors.length) return errorContent(`No active tutor found for ${tutor_email}. Use list_tutors to find the correct email.`);

      await appPost('/api/proposals', {
        tutor_id: tutors[0].id, student_name, student_email, subject,
        requested_schedule: schedule, timezone, start_date, notes, offered_rate, asana_task_id,
      });

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
             start_date, notes, offered_rate, asana_task_id, asana_task_url }) => {
      const result = await appPost('/api/requests', {
        student_name, student_email, subject, requested_schedule: schedule,
        timezone, start_date, notes, offered_rate, asana_task_id, asana_task_url,
      }) as { id: string };
      return textContent(`Request created for ${student_name}${subject ? ` — ${subject}` : ''}. (id: ${result.id})`);
    }),

  tool('show_availability', "Show every active tutor's working hours and calendar busy blocks for the current and next week.",
    { timezone: z.string().default('America/New_York') },
    async ({ timezone }) => {
      const tutors = await sbGet(
        'users', 'role=eq.TUTOR&status=eq.ACTIVE&select=id,name,availability&order=name.asc',
      ) as { id: string; name: string; availability: unknown }[];

      if (!tutors.length) return textContent('No active tutors found.');

      const tutorIds = tutors.map(t => t.id);
      const [week0, week1] = await Promise.all([
        appPost('/api/nylas/weekly-busy', { tutorIds, weekOffset: 0, tz: timezone }),
        appPost('/api/nylas/weekly-busy', { tutorIds, weekOffset: 1, tz: timezone }),
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
    async () => {
      const profile = await appGet('/api/coordinator/profile') as { id: string; asana_project_id: string | null };
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
      const subjects = await appGet('/api/subjects') as { name: string }[];

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
    async ({ message, context }) => {
      // Identify who is leaving feedback via the skill API key
      let coordinator_name: string | null = null;
      try {
        const profile = await appGet('/api/coordinator/profile') as { name?: string };
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
    async ({ limit }) => {
      const rows = await sbGet(
        'skill_feedback',
        `order=created_at.desc&limit=${limit}&select=message,context,coordinator_name,created_at`,
      );
      if (!rows.length) return textContent('No feedback yet.');
      return textContent(JSON.stringify(rows, null, 2));
    }),

];

// ── MCP protocol handler ──────────────────────────────────────────────────────

const TOOL_MAP = new Map(TOOLS.map(t => [t.name, t]));

function mcpError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleMessage(msg: Record<string, unknown>) {
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
      const result = await t.run(args);
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(mcpError(null, -32700, 'Parse error'), { status: 400 });
  }

  // Handle batch or single message
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(msg => handleMessage(msg as Record<string, unknown>)))).filter(Boolean);
    return NextResponse.json(responses);
  }

  const response = await handleMessage(body as Record<string, unknown>);
  if (response === null) return new NextResponse(null, { status: 202 }); // notification acknowledged
  return NextResponse.json(response);
}
