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
