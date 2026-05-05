// Weekly hours calculation from Nylas events tagged as tutoring sessions.
// Unit-tested per spec — see __tests__/capacity.test.ts.

// ── Types ──────────────────────────────────────────────────────────────────

export type CapacityStatus = 'ok' | 'near' | 'at';

/** Minimal Nylas event shape needed for capacity computation. */
export interface NylasEventForCapacity {
  /** Unix timestamp in seconds (Nylas `when.start_time`). */
  start_time: number;
  /** Unix timestamp in seconds (Nylas `when.end_time`). */
  end_time: number;
  title: string;
  /** Key-value metadata stored on the event at creation time. */
  metadata?: Record<string, string> | null;
}

export interface CapacityInfo {
  /** Total tutoring hours in the current ISO week (Mon–Sun UTC). */
  current: number;
  max: number;
  /** max - current, floored at 0. */
  remaining: number;
  status: CapacityStatus;
}

// ── Session detection ──────────────────────────────────────────────────────

/**
 * Returns true if the event should count toward the tutor's weekly hours.
 *
 * An event is a tutoring session when ANY of the following is true:
 *   1. Its title contains "[Tutoring]" (case-insensitive).
 *   2. Its metadata has `simplifi_type === "session"`.
 */
export function isTutoringSession(event: NylasEventForCapacity): boolean {
  if (/\[tutoring\]/i.test(event.title)) return true;
  if (event.metadata?.simplifi_type === 'session') return true;
  return false;
}

// ── Week bounds ────────────────────────────────────────────────────────────

/**
 * Returns the start (Monday 00:00:00.000 UTC) and end (Sunday 23:59:59.999 UTC)
 * of the ISO week that contains `referenceMs` (defaults to now).
 * Both values are Unix timestamps in **milliseconds**.
 */
export function weekBounds(referenceMs: number = Date.now()): { start: number; end: number } {
  const d = new Date(referenceMs);
  // getUTCDay: 0=Sun,1=Mon,...,6=Sat → shift so Mon=0
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek),
  );
  const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return { start: monday.getTime(), end: sunday.getTime() };
}

// ── Weekly hours ───────────────────────────────────────────────────────────

/**
 * Sums the duration (in hours, rounded to 2 decimal places) of all tutoring
 * sessions that overlap the ISO week containing `referenceMs`.
 *
 * An event is included when it IS a tutoring session AND its start_time falls
 * within [weekStart, weekEnd]. Duration is computed as end_time − start_time.
 */
export function computeWeeklyHours(
  events: NylasEventForCapacity[],
  referenceMs: number = Date.now(),
): number {
  const { start, end } = weekBounds(referenceMs);
  const startSec = start / 1000;
  const endSec   = end   / 1000;

  const total = events
    .filter(e => isTutoringSession(e) && e.start_time >= startSec && e.start_time <= endSec)
    .reduce((sum, e) => sum + Math.max(0, e.end_time - e.start_time), 0);

  return Math.round((total / 3600) * 100) / 100;
}

// ── Capacity status + info ─────────────────────────────────────────────────

/**
 * Returns the capacity status for a tutor given current hours and max hours.
 * - 'at'   — current ≥ max
 * - 'near' — current / max ≥ 0.80
 * - 'ok'   — otherwise
 */
export function capacityStatus(current: number, max: number): CapacityStatus {
  if (current >= max) return 'at';
  if (current / max >= 0.8) return 'near';
  return 'ok';
}

/**
 * Convenience wrapper: computes weekly hours from events and returns a full
 * CapacityInfo object ready for display in tutor cards and the `/filter` skill.
 */
export function capacityInfo(
  events: NylasEventForCapacity[],
  max: number,
  referenceMs: number = Date.now(),
): CapacityInfo {
  const current   = computeWeeklyHours(events, referenceMs);
  const remaining = Math.max(0, max - current);
  return { current, max, remaining, status: capacityStatus(current, max) };
}
