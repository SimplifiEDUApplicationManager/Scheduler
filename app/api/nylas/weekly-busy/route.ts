import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchTutorEvents } from '@/lib/nylas/events';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type BusyBlock = { day: number; startH: number; endH: number };

interface WeeklyBusyRequest {
  tutorIds: string[];
  weekOffset: number;
  tz: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Start (Sun 00:00) and end (next Sun 00:00) in Unix seconds for the week at weekOffset, in tz. */
function weekBounds(weekOffset: number, tz: string): { startUnix: number; endUnix: number } {
  const nowZoned = toZonedTime(new Date(), tz);
  nowZoned.setDate(nowZoned.getDate() - nowZoned.getDay() + weekOffset * 7);
  nowZoned.setHours(0, 0, 0, 0);
  const startUnix = Math.floor(fromZonedTime(`${toDateStr(nowZoned)}T00:00:00`, tz).getTime() / 1000);
  nowZoned.setDate(nowZoned.getDate() + 7);
  const endUnix   = Math.floor(fromZonedTime(`${toDateStr(nowZoned)}T00:00:00`, tz).getTime() / 1000);
  return { startUnix, endUnix };
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json() as WeeklyBusyRequest;
  const { tutorIds, weekOffset, tz } = body;

  if (!tutorIds.length) return NextResponse.json({ busySlots: {} });

  const supabase = createServiceClient();
  const { data: tutorRows } = await supabase
    .from('users')
    .select('id, nylas_grant_id')
    .in('id', tutorIds);

  if (!tutorRows?.length) return NextResponse.json({ busySlots: {} });

  const { startUnix, endUnix } = weekBounds(weekOffset, tz);

  // Fetch events per-tutor in parallel using individual Nylas grants.
  // Events are mapped into the coordinator's timezone (tz) so day/startH/endH
  // align with the WeekView column layout.
  const settled = await Promise.all(
    tutorRows.map(async row => {
      if (!row.nylas_grant_id) return { id: row.id as string, events: [] };
      const events = await fetchTutorEvents(row.nylas_grant_id as string, startUnix, endUnix, tz);
      return { id: row.id as string, events };
    }),
  );

  const busySlots: Record<string, BusyBlock[]> = {};
  for (const { id, events } of settled) {
    busySlots[id] = events.map(ev => ({ day: ev.day, startH: ev.start, endH: ev.end }));
  }

  return NextResponse.json({ busySlots });
}
