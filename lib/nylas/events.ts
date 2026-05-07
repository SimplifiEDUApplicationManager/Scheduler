// lib/nylas/events.ts
// Fetch and map Nylas calendar events → TutorEvent[].
// Server-side only.

import { nylasList, grantPath } from './client';
import type { TutorEvent, TutorEventKind, TutorEventStatus } from '@/lib/types/domain';
import { toZonedTime } from 'date-fns-tz';

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

function isTutoringSession(title: string | undefined): boolean {
  return (title ?? '').startsWith('[Tutoring]');
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
    isTutoringSession(ev.title) ? 'session' : 'other';
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

/**
 * Fetch events for a grant within [startUnix, endUnix) and map to TutorEvent[].
 *
 * @param grantId  Nylas grant_id for the tutor's connected calendar.
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
  const params = new URLSearchParams({
    calendar_id:       'primary',
    start:             String(startUnix),
    end:               String(endUnix),
    expand_recurring:  'true',
    limit:             '200',
  });

  const result = await nylasList<NylasEvent>(
    `${grantPath(grantId, 'events')}?${params}`,
  );

  if (!result.ok) {
    console.error('[nylas/events] fetchTutorEvents failed:', result.error);
    return [];
  }

  return result.data
    .map(ev => toTutorEvent(ev, tz))
    .filter((ev): ev is TutorEvent => ev !== null);
}

// ── Week range helper ─────────────────────────────────────────────────────────

/**
 * Return the [startUnix, endUnix] (seconds) for the week that is `weekOffset`
 * weeks from today. Week is Sun–Sat to match the calendar column layout.
 */
export function weekRange(weekOffset: number): { startUnix: number; endUnix: number } {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() + weekOffset * 7);
  sunday.setHours(0, 0, 0, 0);

  const nextSunday = new Date(sunday);
  nextSunday.setDate(sunday.getDate() + 7);

  return {
    startUnix: Math.floor(sunday.getTime()     / 1000),
    endUnix:   Math.floor(nextSunday.getTime() / 1000),
  };
}
