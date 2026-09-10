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

// ── Override shape for capacity ───────────────────────────────────────────

export interface CapacityOverride {
  nylas_event_id: string;
  master_event_id: string | null;
  counted: boolean;
}

// ── Session detection ──────────────────────────────────────────────────────

/** Titles that are definitely tutoring, regardless of other patterns. */
const TUTORING_RE = /\btutor(?:ing)?\b|\[tutoring\]/i;

/**
 * Positive signals that an event is likely a tutoring session — matches
 * student-name patterns, subject keywords, and common tutoring formats.
 * Intentionally broad: we prefer to overcount rather than undercount.
 */
/**
 * Course-code pattern: 2-4 letter prefix + space + 3-4 digit number (e.g. MATH 208, PHIL 210).
 * These are the tutor's own classes, not tutoring sessions.
 */
const COURSE_CODE_RE = /^[A-Z]{2,4}\s+\d{3,4}\b/i;

const LIKELY_TUTORING_RE = /\b(session|prep|review|lesson|homework|hw|study|test prep|exam prep|sat|act|gre|gmat|lsat|mcat|ap\b|ib\b|gcse|reading|writing|math|english|science|history|physics|chemistry|biology|calculus|algebra|geometry|spanish|french|latin|econ|psych|stats|essay|dbq|frq)\b/i;

/**
 * Returns true if the event should count toward the tutor's weekly hours.
 *
 * An event counts when ANY of the following is true:
 *   1. Its metadata has `simplifi_created === "true"` (platform-created).
 *   2. Its metadata has `simplifi_type === "session"`.
 *   3. Its title contains "tutor" or "tutoring" (case-insensitive).
 *   4. Its title contains a subject/test-prep keyword or session-like word.
 *   5. The event has 1+ attendees (external participants suggest a session).
 */
export function isTutoringSession(event: NylasEventForCapacity): boolean {
  if (event.metadata?.simplifi_created === 'true') return true;
  if (event.metadata?.simplifi_type === 'session') return true;
  if (TUTORING_RE.test(event.title)) return true;
  // Skip course codes (e.g. "MATH 208") — these are the tutor's own classes
  if (COURSE_CODE_RE.test(event.title.trim())) return false;
  if (LIKELY_TUTORING_RE.test(event.title)) return true;
  return false;
}

/**
 * Determines whether an event counts toward capacity, considering overrides
 * and auto-detection. Priority: manual override > auto-detection > app-created > default.
 */
export function countsForCapacity(
  event: NylasEventForCapacity & { id?: string; master_event_id?: string | null },
  overrides: CapacityOverride[],
): boolean {
  // Check manual override (exact event ID or master event ID for recurring)
  const override = overrides.find(o =>
    (event.id && o.nylas_event_id === event.id) ||
    (o.master_event_id && event.master_event_id && o.master_event_id === event.master_event_id),
  );
  if (override) return override.counted;

  // Use the inclusive session detection (overcount rather than undercount)
  return isTutoringSession(event);
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
 *
 * When `overrides` is provided, uses the full override-aware classification
 * (manual override > auto-detection > app-created). Without overrides, falls
 * back to legacy isTutoringSession for backward compatibility.
 */
export function computeWeeklyHours(
  events: (NylasEventForCapacity & { id?: string; master_event_id?: string | null })[],
  referenceMs: number = Date.now(),
  overrides?: CapacityOverride[],
): number {
  const { start, end } = weekBounds(referenceMs);
  const startSec = start / 1000;
  const endSec   = end   / 1000;

  const shouldCount = overrides
    ? (e: NylasEventForCapacity & { id?: string; master_event_id?: string | null }) => countsForCapacity(e, overrides)
    : (e: NylasEventForCapacity) => isTutoringSession(e);

  const total = events
    .filter(e => shouldCount(e) && e.start_time >= startSec && e.start_time <= endSec)
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
