/**
 * Simplifi EDU — MCP Server
 *
 * Exposes coordinator skills as MCP tools so they can be called from
 * Claude Cowork or any other MCP-compatible client.
 *
 * Required env vars:
 *   SIMPLIFI_APP_URL        — base URL of the deployed Next.js app
 *   SKILL_API_KEY           — bearer token accepted by /api/* skill routes
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PORT                    — (optional) HTTP port, default 3001
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';

// ── Config ──────────────────────────────────────────────────────────────────

const APP_URL          = (process.env.SIMPLIFI_APP_URL ?? '').replace(/\/$/, '');
const SKILL_API_KEY    = process.env.SKILL_API_KEY ?? '';
const SUPABASE_URL     = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PORT             = Number(process.env.PORT ?? 3001);

function requireEnv() {
  const missing = (
    ['SIMPLIFI_APP_URL', 'SKILL_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const
  ).filter(k => !process.env[k]);
  if (missing.length) {
    console.error('Missing env vars:', missing.join(', '));
    process.exit(1);
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function appHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${SKILL_API_KEY}`, 'Content-Type': 'application/json' };
}

async function appGet(path: string): Promise<unknown> {
  const res = await fetch(`${APP_URL}${path}`, { headers: appHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`App API ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function appPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: appHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`App API ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function sbGet(table: string, qs: string): Promise<unknown[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: SUPABASE_SVC_KEY, Authorization: `Bearer ${SUPABASE_SVC_KEY}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as unknown[];
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

// ── MCP Server ────────────────────────────────────────────────────────────────

function createMcpServer() {
  const s = new McpServer({ name: 'simplifi-edu', version: '1.0.0' });

  // ── show_requests ──────────────────────────────────────────────────────────
  s.tool(
    'show_requests',
    "List the coordinator's tutoring requests.",
    { status: z.enum(['open', 'all']).default('open').describe('open = only unmatched requests; all = every request') },
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
      return ok(JSON.stringify({ count: summary.length, requests: summary }, null, 2));
    },
  );

  // ── list_tutors ────────────────────────────────────────────────────────────
  s.tool(
    'list_tutors',
    'List active tutors with their name and email. Use this to resolve a tutor name to their email before calling send_proposal.',
    {},
    async () => {
      const tutors = await sbGet(
        'users',
        'role=eq.TUTOR&status=eq.ACTIVE&select=name,email&order=name.asc',
      );
      return ok(JSON.stringify(tutors, null, 2));
    },
  );

  // ── send_proposal ──────────────────────────────────────────────────────────
  s.tool(
    'send_proposal',
    'Send a tutoring job proposal to a tutor for a specific student. If you have a request record, pass all schedule/timezone/notes fields from it directly.',
    {
      tutor_email:  z.string().describe("Tutor's email address. Use list_tutors if you only have their name."),
      student_name: z.string(),
      student_email: z.string(),
      subject:      z.string(),
      schedule: z.array(z.object({
        day:   z.number().int().min(0).max(6).describe('0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat'),
        start: z.number().int().min(0).max(23).describe('Start hour'),
        end:   z.number().int().min(0).max(23).describe('End hour'),
      })).describe('Array of availability windows from the request'),
      timezone:     z.string().describe('IANA timezone, e.g. America/New_York'),
      start_date:   z.string().optional().describe('YYYY-MM-DD'),
      notes:        z.string().optional().describe('Full notes from the request record'),
      offered_rate: z.number().int().optional().describe('Hourly rate in dollars (20–40)'),
      asana_task_id: z.string().optional().describe('asana_task_id from the request record if present'),
    },
    async ({ tutor_email, student_name, student_email, subject, schedule, timezone,
              start_date, notes, offered_rate, asana_task_id }) => {
      // Resolve tutor email → tutor_id
      const tutors = await sbGet(
        'users',
        `email=eq.${encodeURIComponent(tutor_email)}&role=eq.TUTOR&status=eq.ACTIVE&select=id,name&limit=1`,
      ) as { id: string; name: string }[];

      if (!tutors.length) {
        return { isError: true, content: [{ type: 'text' as const, text: `No active tutor found for ${tutor_email}. Use list_tutors to find the correct email.` }] };
      }

      const tutor = tutors[0];
      await appPost('/api/proposals', {
        tutor_id:           tutor.id,
        student_name,
        student_email,
        subject,
        requested_schedule: schedule,
        timezone,
        start_date,
        notes,
        offered_rate,
        asana_task_id,
      });

      return ok(`Proposal sent to ${tutor.name} (${tutor_email}) — ${student_name}, ${subject}.`);
    },
  );

  // ── create_request ─────────────────────────────────────────────────────────
  s.tool(
    'create_request',
    'Log a new tutoring request from an intake call or transcript. Creates one request per subject — call multiple times if there are multiple subjects.',
    {
      student_name:  z.string(),
      student_email: z.string().optional(),
      subject:       z.string().optional(),
      schedule: z.array(z.object({
        day:   z.number().int().min(0).max(6),
        start: z.number().int().min(0).max(23),
        end:   z.number().int().min(0).max(23),
      })).optional(),
      timezone:     z.string().optional().describe('IANA timezone'),
      start_date:   z.string().optional().describe('YYYY-MM-DD'),
      notes:        z.string().optional().describe('Full intake notes or transcript'),
      offered_rate: z.number().int().optional().describe('Hourly rate in dollars (20–40)'),
    },
    async ({ student_name, student_email, subject, schedule, timezone, start_date, notes, offered_rate }) => {
      const result = await appPost('/api/requests', {
        student_name,
        student_email,
        subject,
        requested_schedule: schedule,
        timezone,
        start_date,
        notes,
        offered_rate,
      }) as { id: string };
      return ok(`Request created for ${student_name}${subject ? ` — ${subject}` : ''}. (id: ${result.id})`);
    },
  );

  // ── show_availability ──────────────────────────────────────────────────────
  s.tool(
    'show_availability',
    "Show every active tutor's working hours and calendar busy blocks for the current and next week. Free windows = workingHours minus busyThisWeek/busyNextWeek.",
    { timezone: z.string().default('America/New_York').describe('Display timezone for the output') },
    async ({ timezone }) => {
      const tutors = await sbGet(
        'users',
        'role=eq.TUTOR&status=eq.ACTIVE&select=id,name,availability&order=name.asc',
      ) as { id: string; name: string; availability: Record<string, [number, number][]> | null }[];

      if (!tutors.length) return ok('No active tutors found.');

      const tutorIds = tutors.map(t => t.id);

      const [week0, week1] = await Promise.all([
        appPost('/api/nylas/weekly-busy', { tutorIds, weekOffset: 0, tz: timezone }),
        appPost('/api/nylas/weekly-busy', { tutorIds, weekOffset: 1, tz: timezone }),
      ]) as [{ busySlots: Record<string, { day: number; startH: number; endH: number }[]> },
               { busySlots: Record<string, { day: number; startH: number; endH: number }[]> }];

      const result = tutors.map(t => ({
        name:         t.name,
        workingHours: t.availability ?? {},
        busyThisWeek: week0.busySlots?.[t.id] ?? [],
        busyNextWeek: week1.busySlots?.[t.id] ?? [],
      }));

      return ok(JSON.stringify({ timezone, tutors: result }, null, 2));
    },
  );

  // ── sync_requests ─────────────────────────────────────────────────────────
  s.tool(
    'sync_requests',
    `Fetch all incomplete tasks from the "New Tutoring Request" section of the coordinator's Asana project, plus the app's subject list.

After calling this tool:
1. For each task, extract ALL subjects from the notes (look for "Subjects:" line — multiple subjects = multiple requests).
2. For each (task × subject) pair, call create_request with:
   - student_name: task name (strip any "Tutoring - " prefix)
   - student_email: parsed from notes ("Student Email:" line)
   - subject: matched against the returned subjects list (case-insensitive, partial match ok; if no match set to null and append original to notes)
   - schedule: inferred from notes using these rules:
       "evenings and weekends" → Mon–Fri day:1-5 start:18 end:23, Sat–Sun day:6,0 start:8 end:23
       "evenings" → all 7 days start:18 end:23
       "weekdays" → Mon–Fri start:8 end:23
       "weekends" → Sat–Sun start:8 end:23
       "morning" = start:8 end:12, "afternoon" = start:13 end:18, "evening" = start:18 end:23
   - timezone: infer IANA from notes (MSK→Europe/Moscow, ET→America/New_York, PT→America/Los_Angeles, etc.)
   - start_date: task due_on (already ISO format)
   - notes: full original task notes
   - asana_task_id: "{gid}::{subject_lowercase_underscored}" (e.g. "1234::ap_calculus_bc") — this makes it idempotent (safe to run twice)
3. Return a summary table of all submitted requests.`,
    {},
    async () => {
      // Get coordinator profile (asana_project_id) via the app API
      const profile = await appGet('/api/coordinator/profile') as {
        id: string; asana_project_id: string | null;
      };

      if (!profile.asana_project_id) {
        return { isError: true, content: [{ type: 'text' as const, text: 'No Asana project connected. Go to app Settings → Asana to connect your project.' }] };
      }

      // Get asana_access_token directly from Supabase (not exposed via profile endpoint)
      const coordRows = await sbGet(
        'users',
        `id=eq.${profile.id}&select=asana_access_token&limit=1`,
      ) as { asana_access_token: string | null }[];

      const token = coordRows[0]?.asana_access_token;
      if (!token) {
        return { isError: true, content: [{ type: 'text' as const, text: 'No Asana access token stored. Go to app Settings → Asana to reconnect.' }] };
      }

      // Find "New Tutoring Request" section in the project
      const sectionsRes = await fetch(
        `https://app.asana.com/api/1.0/projects/${profile.asana_project_id}/sections?opt_fields=gid,name`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      );
      if (!sectionsRes.ok) {
        const body = await sectionsRes.text();
        return { isError: true, content: [{ type: 'text' as const, text: `Asana error fetching sections: ${sectionsRes.status} ${body.slice(0, 200)}` }] };
      }
      const { data: sections } = await sectionsRes.json() as { data: { gid: string; name: string }[] };
      const section = sections.find(s => /new.?tutoring.?request/i.test(s.name));
      if (!section) {
        return { isError: true, content: [{ type: 'text' as const, text: `No "New Tutoring Request" section found in the project. Sections found: ${sections.map(s => s.name).join(', ')}` }] };
      }

      // Fetch incomplete tasks in that section
      const tasksRes = await fetch(
        `https://app.asana.com/api/1.0/sections/${section.gid}/tasks?opt_fields=gid,name,notes,due_on,permalink_url&completed_since=now`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      );
      if (!tasksRes.ok) {
        const body = await tasksRes.text();
        return { isError: true, content: [{ type: 'text' as const, text: `Asana error fetching tasks: ${tasksRes.status} ${body.slice(0, 200)}` }] };
      }
      const { data: tasks } = await tasksRes.json() as {
        data: { gid: string; name: string; notes: string; due_on: string | null; permalink_url: string }[]
      };

      // Fetch app subject list for matching
      const subjects = await appGet('/api/subjects') as { id: string; name: string }[];

      return ok(JSON.stringify({
        task_count: tasks.length,
        subjects: subjects.map(s => s.name),
        tasks: tasks.map(t => ({
          gid:           t.gid,
          name:          t.name,
          notes:         t.notes,
          due_on:        t.due_on,
          permalink_url: t.permalink_url,
        })),
      }, null, 2));
    },
  );

  return s;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function main() {
  requireEnv();

  const mcpServer = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transport);

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Health check
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, server: 'simplifi-edu-mcp' }));
      return;
    }

    try {
      const body = await readBody(req);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error('[mcp] unhandled error:', err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Internal server error');
      }
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`Simplifi MCP server listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
