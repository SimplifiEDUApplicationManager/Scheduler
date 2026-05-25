import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { nylasPost } from '@/lib/nylas/client';
import type { Tuple } from '@/lib/types/domain';
import { fromZonedTime } from 'date-fns-tz';

export type CalendarStatus = 'free' | 'conflict' | 'no_calendar' | 'unknown';

interface FreeBusyRequest {
  tutorIds: string[];
  tuples: Tuple[];
  tz: string;
}

type NylasTimeSlot = { start_time: number; end_time: number; status: string };
type NylasFreeBusyEntry = { email: string; time_slots?: NylasTimeSlot[]; error?: string };

// Returns the next `count` occurrences of `dayOfWeek` (0=Sun) from now.
// The returned dates have their time component left at midnight local —
// callers set the hour/minute themselves.
function nextOccurrences(dayOfWeek: number, count: number): Date[] {
  const dates: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1); // start from tomorrow
  while (dates.length < count) {
    if (d.getDay() === dayOfWeek) dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Expand a set of tuples into concrete [startUnix, endUnix] pairs using the
// next 2 occurrences of each requested day.
function expandTuples(tuples: Tuple[], tz: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (const tuple of tuples) {
    const occurrences = nextOccurrences(tuple.day, 2);
    for (const date of occurrences) {
      const startH = Math.floor(tuple.start);
      const startM = Math.round((tuple.start % 1) * 60);
      const endH   = Math.floor(tuple.end);
      const endM   = Math.round((tuple.end % 1) * 60);

      // Build a local datetime string in the requested timezone, then convert to UTC.
      const startLocal = new Date(date);
      startLocal.setHours(startH, startM, 0, 0);
      const endLocal = new Date(date);
      endLocal.setHours(endH, endM, 0, 0);

      ranges.push({
        start: Math.floor(fromZonedTime(startLocal, tz).getTime() / 1000),
        end:   Math.floor(fromZonedTime(endLocal, tz).getTime() / 1000),
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
