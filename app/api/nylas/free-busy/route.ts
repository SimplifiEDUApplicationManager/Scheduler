import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { nylasPost } from '@/lib/nylas/client';
import type { Tuple } from '@/lib/types/domain';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type CalendarStatus = 'free' | 'conflict' | 'no_calendar' | 'unknown';

interface FreeBusyRequest {
  tutorIds: string[];
  tuples: Tuple[];
  tz: string;
}

type NylasTimeSlot = { start_time: number; end_time: number; status: string };
type NylasFreeBusyEntry = { email: string; time_slots?: NylasTimeSlot[]; error?: string };

// Returns the next `count` occurrences of `dayOfWeek` (0=Sun) starting from
// tomorrow in the coordinator's timezone. Uses toZonedTime so that getDay()
// and date arithmetic operate in `tz`, not the server's local timezone.
function nextOccurrences(dayOfWeek: number, count: number, tz: string): Date[] {
  const dates: Date[] = [];
  // toZonedTime shifts the Date so that its local-time accessors (.getDate(),
  // .getDay() etc.) reflect wall-clock time in `tz`. Valid on UTC servers
  // (Vercel) where local accessors == UTC accessors.
  const d = toZonedTime(new Date(), tz);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1); // start from tomorrow in `tz`
  while (dates.length < count) {
    if (d.getDay() === dayOfWeek) dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Expand a set of tuples into concrete [startUnix, endUnix] pairs using the
// next 2 occurrences of each requested day (in the coordinator's timezone).
function expandTuples(tuples: Tuple[], tz: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (const tuple of tuples) {
    const occurrences = nextOccurrences(tuple.day, 2, tz);
    for (const date of occurrences) {
      const startH = Math.floor(tuple.start);
      const startM = Math.round((tuple.start % 1) * 60);
      const endH   = Math.floor(tuple.end);
      const endM   = Math.round((tuple.end % 1) * 60);

      // `date` is a toZonedTime result: its year/month/date parts are in `tz`.
      // Build ISO strings with no TZ suffix so fromZonedTime interprets them
      // as wall-clock time in `tz` — avoids the double-offset bug from
      // passing a Date (which carries a UTC value) directly to fromZonedTime.
      const dateStr  = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const startStr = `${dateStr}T${pad(startH)}:${pad(startM)}:00`;
      const endStr   = `${dateStr}T${pad(endH)}:${pad(endM)}:00`;

      ranges.push({
        start: Math.floor(fromZonedTime(startStr, tz).getTime() / 1000),
        end:   Math.floor(fromZonedTime(endStr, tz).getTime() / 1000),
      });
    }
  }
  return ranges;
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json() as FreeBusyRequest;
  const { tutorIds, tuples, tz } = body;

  if (!tutorIds.length || !tuples.length) {
    return NextResponse.json({ results: {} });
  }

  // Use service client to read tutor emails (coordinator's anon client may not
  // have SELECT access to all users rows depending on RLS).
  const supabase = createServiceClient();
  const { data: tutorRows } = await supabase
    .from('users')
    .select('id, email')
    .in('id', tutorIds);

  if (!tutorRows?.length) {
    return NextResponse.json({ results: {} });
  }

  const emailById = new Map(tutorRows.map(t => [t.id, t.email as string]));
  const emails    = tutorRows.map(t => t.email as string);

  // Expand tuples to concrete time ranges for the next 2 occurrences.
  const ranges = expandTuples(tuples, tz);
  if (!ranges.length) return NextResponse.json({ results: {} });

  const startTime = Math.min(...ranges.map(r => r.start));
  const endTime   = Math.max(...ranges.map(r => r.end));

  // POST /v3/calendars/free-busy — org-level call, returns busy periods per email.
  const result = await nylasPost<NylasFreeBusyEntry[]>('/v3/calendars/free-busy', {
    emails,
    start_time: startTime,
    end_time:   endTime,
  });

  if (!result.ok) {
    console.error('[api/nylas/free-busy] Nylas error:', result.error);
    const results: Record<string, CalendarStatus> = {};
    for (const id of tutorIds) results[id] = 'unknown';
    return NextResponse.json({ results });
  }

  const freeBusyByEmail = new Map(result.data.map(fb => [fb.email, fb]));

  const results: Record<string, CalendarStatus> = {};

  for (const tutorId of tutorIds) {
    const email = emailById.get(tutorId);
    if (!email) { results[tutorId] = 'unknown'; continue; }

    const fb = freeBusyByEmail.get(email);
    if (!fb || fb.error) { results[tutorId] = 'no_calendar'; continue; }

    const busySlots = fb.time_slots ?? [];

    // A tutor has a conflict if ANY checked range overlaps with a busy slot.
    const hasConflict = ranges.some(range =>
      busySlots.some(slot =>
        slot.status === 'busy' &&
        slot.start_time < range.end &&
        slot.end_time   > range.start,
      ),
    );

    results[tutorId] = hasConflict ? 'conflict' : 'free';
  }

  return NextResponse.json({ results });
}
