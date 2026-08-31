import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchTutorEvents } from '@/lib/nylas/events';
import type { Tuple } from '@/lib/types/domain';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type CalendarStatus = 'free' | 'conflict' | 'no_calendar' | 'unknown';

interface FreeBusyRequest {
  tutorIds: string[];
  tuples: Tuple[];
  tz: string;
}

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

  const supabase = createServiceClient();
  const { data: tutorRows } = await supabase
    .from('users')
    .select('id, nylas_grant_id, selected_calendar_ids')
    .in('id', tutorIds);

  if (!tutorRows?.length) {
    return NextResponse.json({ results: {} });
  }

  const grantById = new Map(tutorRows.map(t => [t.id as string, t.nylas_grant_id as string | null]));
  const selectedCalsById = new Map(tutorRows.map(t => [t.id as string, (t.selected_calendar_ids as string[] | null)]));

  // Expand tuples to concrete time ranges for the next 2 occurrences.
  const ranges = expandTuples(tuples, tz);
  if (!ranges.length) return NextResponse.json({ results: {} });

  const startTime = Math.min(...ranges.map(r => r.start));
  const endTime   = Math.max(...ranges.map(r => r.end));

  // Fetch events per-tutor in parallel using individual Nylas grants.
  const settled = await Promise.all(
    tutorIds.map(async tutorId => {
      const grantId = grantById.get(tutorId);
      if (!grantId) return { tutorId, events: null };
      const events = await fetchTutorEvents(grantId, startTime, endTime, tz, [], selectedCalsById.get(tutorId));
      return { tutorId, events };
    }),
  );

  const results: Record<string, CalendarStatus> = {};

  for (const { tutorId, events } of settled) {
    if (events === null) { results[tutorId] = 'no_calendar'; continue; }

    // A tutor has a conflict if any event overlaps any requested tuple window.
    // Events are fetched for the range covering the tuple occurrences, and are
    // mapped into the coordinator's tz, so ev.day/start/end align with tuple.day/start/end.
    const hasConflict = tuples.some(tp =>
      events.some(ev => ev.day === tp.day && ev.start < tp.end && ev.end > tp.start),
    );

    results[tutorId] = hasConflict ? 'conflict' : 'free';
  }

  return NextResponse.json({ results });
}
