import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { nylasPost } from '@/lib/nylas/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type BusyBlock = { day: number; startH: number; endH: number };

interface WeeklyBusyRequest {
  tutorIds: string[];
  weekOffset: number;
  tz: string;
}

type NylasTimeSlot = { start_time: number; end_time: number; status: string };
type NylasFreeBusyEntry = { email: string; time_slots?: NylasTimeSlot[]; error?: string };

const pad = (n: number) => String(n).padStart(2, '0');

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Start (Sun 00:00) and end (next Sun 00:00) in Unix seconds for the week at weekOffset, in tz. */
function weekBounds(weekOffset: number, tz: string): { startUnix: number; endUnix: number } {
  // toZonedTime shifts the Date so local-time accessors reflect tz (valid on UTC servers).
  const nowZoned = toZonedTime(new Date(), tz);
  // Move to Sunday of the target week
  nowZoned.setDate(nowZoned.getDate() - nowZoned.getDay() + weekOffset * 7);
  nowZoned.setHours(0, 0, 0, 0);
  const startUnix = Math.floor(fromZonedTime(`${toDateStr(nowZoned)}T00:00:00`, tz).getTime() / 1000);
  nowZoned.setDate(nowZoned.getDate() + 7);
  const endUnix   = Math.floor(fromZonedTime(`${toDateStr(nowZoned)}T00:00:00`, tz).getTime() / 1000);
  return { startUnix, endUnix };
}

/** Decimal hour (0–24) for a Unix timestamp in tz. */
function decimalHour(unix: number, tz: string): number {
  const d = toZonedTime(new Date(unix * 1000), tz);
  return d.getHours() + d.getMinutes() / 60;
}

/** Day-of-week (0=Sun) for a Unix timestamp in tz. */
function dayOfWeek(unix: number, tz: string): number {
  return toZonedTime(new Date(unix * 1000), tz).getDay();
}

/** Split a busy slot that may span multiple days into per-day BusyBlocks. */
function splitSlot(startUnix: number, endUnix: number, tz: string): BusyBlock[] {
  const blocks: BusyBlock[] = [];
  let segStart = startUnix;

  while (segStart < endUnix) {
    const startDay = dayOfWeek(segStart, tz);
    // Find midnight of next day in tz
    const d = toZonedTime(new Date(segStart * 1000), tz);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    const midnightUnix = Math.floor(fromZonedTime(`${toDateStr(d)}T00:00:00`, tz).getTime() / 1000);
    const segEnd = Math.min(midnightUnix, endUnix);

    blocks.push({
      day:    startDay,
      startH: decimalHour(segStart, tz),
      endH:   segEnd >= midnightUnix ? 24 : decimalHour(segEnd, tz),
    });

    segStart = segEnd;
  }

  return blocks;
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
    .select('id, email')
    .in('id', tutorIds);

  if (!tutorRows?.length) return NextResponse.json({ busySlots: {} });

  const emailById = new Map(tutorRows.map(t => [t.id, t.email as string]));
  const emails    = tutorRows.map(t => t.email as string);

  const { startUnix, endUnix } = weekBounds(weekOffset, tz);

  const result = await nylasPost<NylasFreeBusyEntry[]>('/v3/calendars/free-busy', {
    emails,
    start_time: startUnix,
    end_time:   endUnix,
  });

  if (!result.ok) {
    return NextResponse.json({ busySlots: {} });
  }

  const freeBusyByEmail = new Map(result.data.map(fb => [fb.email, fb]));
  const busySlots: Record<string, BusyBlock[]> = {};

  for (const tutorId of tutorIds) {
    const email = emailById.get(tutorId);
    if (!email) { busySlots[tutorId] = []; continue; }

    const fb = freeBusyByEmail.get(email);
    if (!fb || fb.error) { busySlots[tutorId] = []; continue; }

    const blocks: BusyBlock[] = [];
    for (const slot of fb.time_slots ?? []) {
      if (slot.status !== 'busy') continue;
      blocks.push(...splitSlot(slot.start_time, slot.end_time, tz));
    }
    busySlots[tutorId] = blocks;
  }

  return NextResponse.json({ busySlots });
}
