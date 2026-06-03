// lib/nylas/events.ts
// Fetch and map Nylas calendar events → TutorEvent[].
// Server-side only.

import { nylasList, nylasPost, grantPath } from './client';
import type { TutorEvent, TutorEventKind, TutorEventStatus } from '@/lib/types/domain';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// ── Nylas v3 event shape (subset we care about) ───────────────────────────────

type NylasWhen =
  | { object: 'timespan';  start_time: number; end_time: number }
  | { object: 'time';      time: number }
  | { object: 'date';      date: string }
  | { object: 'datespan';  start_date: string; end_date: string };

interface NylasEvent {
  id: string;
  title?: string;
  status?: 'confirmed' | 'cancelled' | 'tentative';
  when: NylasWhen;
  busy?: boolean;
  recurrence?: string[] | null;
  description?: string | null;
  metadata?: Record<string, string> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDecimalHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

function nylasStatusToEvent(
  status: NylasEvent['status'],
  startMs: number,
): TutorEventStatus {
  if (status === 'cancelled') return 'cancelled';
  if (startMs < Date.now()) return 'completed';
  return 'upcoming';
}

function isTutoringSession(ev: NylasEvent): boolean {
  // Primary marker: metadata set at creation time by the platform.
  // Fallback: [Tutoring] title prefix for events created before metadata was added.
  return ev.metadata?.simplifi_created === 'true' || (ev.title ?? '').startsWith('[Tutoring]');
}

// ── Mapper ────────────────────────────────────────────────────────────────────

/**
 * Map a single Nylas event to a TutorEvent using the tutor's IANA timezone.
 * Returns null for all-day or dateless events (they don't fit the hour-grid).
 */
function toTutorEvent(ev: NylasEvent, tz: string): TutorEvent | null {
  const when = ev.when;
  if (when.object !== 'timespan') return null; // skip all-day / instant events

  const startMs = when.start_time * 1000;
  const endMs   = when.end_time   * 1000;
  const zonedStart = toZonedTime(startMs, tz);
  const zonedEnd   = toZonedTime(endMs,   tz);

  const kind: TutorEventKind =
    isTutoringSession(ev) ? 'session' : 'other';
  const status: TutorEventStatus =
    nylasStatusToEvent(ev.status, startMs);

  const title = ev.title?.replace(/^\[Tutoring\]\s*/, '') ?? '(No title)';

  return {
    id:        ev.id,
    day:       zonedStart.getDay(),          // 0=Sun … 6=Sat
    start:     toDecimalHour(zonedStart),
    end:       toDecimalHour(zonedEnd),
    title,
    kind,
    status,
    recurring: Array.isArray(ev.recurrence) && ev.recurrence.length > 0,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Nylas calendar shape (subset). */
interface NylasCalendar {
  id: string;
  read_only: boolean;
}

/**
 * Fetch all writable calendar IDs for a grant.
 * Falls back to ['primary'] on error so callers always get something.
 */
async function fetchCalendarIds(grantId: string): Promise<string[]> {
  const result = await nylasList<NylasCalendar>(
    `${grantPath(grantId, 'calendars')}?limit=50`,
  );
  if (!result.ok) {
    console.error('[nylas/events] fetchCalendarIds failed:', result.error);
    return ['primary'];
  }
  const ids = result.data.filter(c => !c.read_only).map(c => c.id);
  return ids.length > 0 ? ids : ['primary'];
}

/**
 * Fetch all events for a single calendar, following next_cursor pagination.
 */
async function fetchEventsForCalendar(
  grantId: string,
  calendarId: string,
  startUnix: number,
  endUnix: number,
): Promise<NylasEvent[]> {
  const baseParams = new URLSearchParams({
    calendar_id:      calendarId,
    start:            String(startUnix),
    end:              String(endUnix),
    expand_recurring: 'true',
    limit:            '200',
  });

  const events: NylasEvent[] = [];
  let url = `${grantPath(grantId, 'events')}?${baseParams}`;

  while (url) {
    const result = await nylasList<NylasEvent>(url);
    if (!result.ok) {
      console.error(`[nylas/events] fetchEventsForCalendar(${calendarId}) failed:`, result.error);
      break;
    }
    events.push(...result.data);
    url = result.nextCursor
      ? `${grantPath(grantId, 'events')}?${baseParams}&page_token=${result.nextCursor}`
      : '';
  }

  return events;
}

/**
 * Fetch events for a grant within [startUnix, endUnix) and map to TutorEvent[].
 * Queries all writable calendars and deduplicates by event ID.
 *
 * @param grantId    Nylas grant_id for the tutor's connected calendar.
 * @param startUnix  Week start in Unix seconds (inclusive).
 * @param endUnix    Week end in Unix seconds (exclusive).
 * @param tz         Tutor's IANA timezone (e.g. "America/New_York").
 */
export async function fetchTutorEvents(
  grantId: string,
  startUnix: number,
  endUnix: number,
  tz: string,
): Promise<TutorEvent[]> {
  const calendarIds = await fetchCalendarIds(grantId);

  const perCalendar = await Promise.all(
    calendarIds.map(id => fetchEventsForCalendar(grantId, id, startUnix, endUnix)),
  );

  // Flatten and deduplicate by event ID (same event can appear in multiple calendars)
  const seen = new Set<string>();
  const allEvents: NylasEvent[] = [];
  for (const batch of perCalendar) {
    for (const ev of batch) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        allEvents.push(ev);
      }
    }
  }

  return allEvents
    .map(ev => toTutorEvent(ev, tz))
    .filter((ev): ev is TutorEvent => ev !== null && ev.kind === 'session');
}

// ── Capacity event fetch ──────────────────────────────────────────────────────

import type { NylasEventForCapacity } from '@/lib/utils/capacity';
import { weekBounds } from '@/lib/utils/capacity';

/**
 * Fetch all calendar events in the current ISO week (Mon–Sun UTC) for a
 * tutor's grant, returning them shaped for `computeWeeklyHours` in capacity.ts.
 */
export async function fetchTutorEventsForCapacity(
  grantId: string,
): Promise<NylasEventForCapacity[]> {
  const { start, end } = weekBounds();
  const startSec = Math.floor(start / 1000);
  const endSec   = Math.floor(end   / 1000);

  const calendarIds = await fetchCalendarIds(grantId);
  const perCalendar = await Promise.all(
    calendarIds.map(id => fetchEventsForCalendar(grantId, id, startSec, endSec)),
  );

  const seen = new Set<string>();
  const result: NylasEventForCapacity[] = [];
  for (const batch of perCalendar) {
    for (const ev of batch) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      const when = ev.when;
      if (when.object !== 'timespan') continue;
      result.push({
        start_time: when.start_time,
        end_time:   when.end_time,
        title:      ev.title ?? '',
        metadata:   null,
      });
    }
  }
  return result;
}

// ── Week range helper ─────────────────────────────────────────────────────────

// ── Booking creation ──────────────────────────────────────────────────────────

interface NylasEventCreateBody {
  title: string;
  when: { object: 'timespan'; start_time: number; end_time: number };
  participants?: { email: string; name: string; status?: string }[];
  location?: string;
  recurrence?: string[];
  metadata?: Record<string, string>;
}

interface CreatedNylasEvent {
  id: string;
}

/**
 * Convert a day-of-week / decimal-hour availability tuple to absolute Unix seconds.
 * Finds the next occurrence of `dayOfWeek` on or after `fromDateIso` (defaults to today).
 * Times are interpreted in `tz`.
 */
export function tupleToUnix(
  dayOfWeek: number,
  startDecimal: number,
  endDecimal: number,
  tz: string,
  fromDateIso?: string | null,
): { startUnix: number; endUnix: number } {
  // Anchor to noon UTC on the from-date to avoid DST edge-cases with midnight.
  const anchor = fromDateIso ? new Date(`${fromDateIso}T12:00:00Z`) : new Date();
  const anchorLocal = toZonedTime(anchor, tz);

  const daysUntil = (dayOfWeek - anchorLocal.getDay() + 7) % 7;
  const sessionLocal = new Date(anchorLocal);
  sessionLocal.setDate(anchorLocal.getDate() + daysUntil);

  const toUnix = (decimal: number): number => {
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    const d = new Date(sessionLocal);
    d.setHours(h, m, 0, 0);
    return Math.floor(fromZonedTime(d, tz).getTime() / 1000);
  };

  return { startUnix: toUnix(startDecimal), endUnix: toUnix(endDecimal) };
}

/**
 * Create a tutoring session event on the tutor's first writable calendar.
 * Returns the Nylas event ID, or null on failure.
 *
 * The event title uses the `[Tutoring]` prefix so it is counted by the
 * capacity tracker and appears as kind: 'session' in the tutor calendar.
 */
export async function createTutoringEvent(
  grantId: string,
  params: {
    studentName: string;
    studentEmail: string;
    subject: string;
    startUnix: number;
    endUnix: number;
    meetingLink?: string;
    // For Google Calendar, the primary calendar ID is the tutor's email address.
    // Pass it here to ensure the event lands on the correct calendar.
    // Falls back to the first writable calendar from the Nylas API.
    calendarId?: string;
  },
): Promise<string | null> {
  // Resolve the target calendar: use the provided ID (tutor's email for Google),
  // or fall back to fetching the first writable calendar from Nylas.
  const calendarId = params.calendarId ?? (await fetchCalendarIds(grantId))[0];

  const body: NylasEventCreateBody = {
    title: `[Tutoring] ${params.studentName} — ${params.subject}`,
    when: { object: 'timespan', start_time: params.startUnix, end_time: params.endUnix },
    participants: [{ email: params.studentEmail, name: params.studentName, status: 'noreply' }],
    recurrence: ['RRULE:FREQ=WEEKLY'],
    metadata: { simplifi_created: 'true' },
    ...(params.meetingLink ? { location: params.meetingLink } : {}),
  };

  const result = await nylasPost<CreatedNylasEvent>(
    `${grantPath(grantId, 'events')}?calendar_id=${encodeURIComponent(calendarId)}&notify_participants=true`,
    body,
  );

  if (!result.ok) {
    console.error('[nylas/events] createTutoringEvent failed:', result.error, { calendarId });
    return null;
  }

  return result.data.id;
}

// ── Week range helper ─────────────────────────────────────────────────────────

/**
 * Return the [startUnix, endUnix] (seconds) for the week that is `weekOffset`
 * weeks from today. Week is Sun–Sat to match the calendar column layout.
 */
export function weekRange(weekOffset: number): { startUnix: number; endUnix: number } {
  const now = new Date();
  // Use UTC date components so the week boundary is consistent regardless of
  // the server's local timezone (Vercel runs in UTC, but this makes it explicit).
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const sundayMs =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    - dayOfWeek * 86_400_000
    + weekOffset * 7 * 86_400_000;

  return {
    startUnix: Math.floor(sundayMs / 1000),
    endUnix:   Math.floor(sundayMs / 1000) + 7 * 86_400,
  };
}
