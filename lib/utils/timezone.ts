// Timezone conversion utilities using date-fns-tz only. Never moment.js.
// Unit-tested per spec — see __tests__/timezone.test.ts.

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { Tuple } from '@/lib/types/domain';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UtcRange {
  start: Date;
  end: Date;
}

// ── Tuple → UTC range ──────────────────────────────────────────────────────

/**
 * Converts a schedule Tuple (day-of-week + decimal hours in `tz`) to a UTC
 * Date range for the ISO week that begins on `weekMondayUtcMs`.
 *
 * Tuple.day: 0 = Sun, 1 = Mon, … 6 = Sat.
 * Tuple.start/end: decimal hours in local time, e.g. 16.5 = 4:30 PM.
 *
 * Handles DST correctly: `fromZonedTime` resolves wall-clock ambiguity via
 * the IANA tz database so spring-forward and fall-back are handled automatically.
 */
export function tupleToUtcRange(
  tuple: Tuple,
  weekMondayUtcMs: number,
  tz: string,
): UtcRange {
  // Offset in days from Monday (day=1) to the tuple's day.
  // day 0 (Sun) = 6, day 1 (Mon) = 0, day 2 (Tue) = 1, … day 6 (Sat) = 5
  const dayOffset = (tuple.day - 1 + 7) % 7;
  const dayUtcMs  = weekMondayUtcMs + dayOffset * 86_400_000;

  return {
    start: _decimalToZoned(dayUtcMs, tuple.start, tz),
    end:   _decimalToZoned(dayUtcMs, tuple.end,   tz),
  };
}

// ── UTC → display ──────────────────────────────────────────────────────────

/**
 * Formats a UTC timestamp as a human-readable string in the given timezone.
 *
 * @param utcMs   - Unix timestamp in milliseconds.
 * @param tz      - IANA timezone, e.g. "America/New_York".
 * @param pattern - date-fns format pattern. Defaults to "h:mm a zzz" (e.g. "4:00 PM EST").
 */
export function formatInTz(
  utcMs: number,
  tz: string,
  pattern: string = 'h:mm a zzz',
): string {
  return formatInTimeZone(new Date(utcMs), tz, pattern);
}

// ── Decimal hour → display ─────────────────────────────────────────────────

/**
 * Formats a decimal 24h hour as a 12h AM/PM string.
 *
 * @example formatDecimalHour(16)    → "4:00 PM"
 * @example formatDecimalHour(17.5)  → "5:30 PM"
 * @example formatDecimalHour(9.25)  → "9:15 AM"
 * @example formatDecimalHour(0)     → "12:00 AM"
 * @example formatDecimalHour(12)    → "12:00 PM"
 */
export function formatDecimalHour(decimal: number): string {
  const h  = Math.floor(decimal);
  const m  = Math.round((decimal - h) * 60);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h % 12 === 0 ? 12 : h % 12;
  const mm   = String(m).padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

// ── Tuple timezone conversion ──────────────────────────────────────────────

// Fixed reference Monday in a northern-hemisphere winter week.
// Using a stable anchor lets us do wall-clock conversions without picking an
// arbitrary "today" — the relative offset is what matters for recurring slots.
const REFERENCE_MON_MS = Date.UTC(2025, 0, 6); // Mon 2025-01-06 00:00:00 UTC

/**
 * Converts a recurring schedule Tuple from one IANA timezone to another.
 *
 * Uses a fixed reference week so the result is deterministic regardless of
 * when the function is called. Works for any pair of IANA timezones.
 *
 * @example
 * // Mon 5–7 PM ET → Mon 2–4 PM PT
 * convertTupleTimezone({ day: 1, start: 17, end: 19 }, 'America/New_York', 'America/Los_Angeles')
 * // → { day: 1, start: 14, end: 16 }
 */
export function convertTupleTimezone(tuple: Tuple, fromTz: string, toTz: string): Tuple {
  if (fromTz === toTz) return tuple;

  const { start: utcStart, end: utcEnd } = tupleToUtcRange(tuple, REFERENCE_MON_MS, fromTz);

  // ISO day of week: 1=Mon … 7=Sun → map to 0=Sun … 6=Sat via mod 7
  const isoDay = Number(formatInTimeZone(utcStart, toTz, 'i'));
  const day = isoDay % 7;

  const toDecimal = (d: Date) =>
    Number(formatInTimeZone(d, toTz, 'H')) + Number(formatInTimeZone(d, toTz, 'm')) / 60;

  const start = toDecimal(utcStart);
  const rawEnd = toDecimal(utcEnd);
  // If end appears to precede start, the session crossed midnight in toTz.
  // Add 24 so end > start is always true (e.g. 25 = 1 AM the next day).
  // fmtHour handles values ≥ 24 by normalising with % 24.
  const end = rawEnd < start ? rawEnd + 24 : rawEnd;

  return { day, start, end };
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Given the UTC ms for a calendar day and a decimal hour, returns the
 * corresponding UTC Date by treating the decimal hour as wall-clock time in `tz`.
 */
function _decimalToZoned(dayUtcMs: number, decimalHour: number, tz: string): Date {
  const d    = new Date(dayUtcMs);
  const year = d.getUTCFullYear();
  const mon  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day  = String(d.getUTCDate()).padStart(2, '0');

  const h  = Math.floor(decimalHour);
  const m  = Math.round((decimalHour - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');

  // e.g. "2025-03-04T17:00:00" interpreted as wall-clock time in `tz`
  return fromZonedTime(`${year}-${mon}-${day}T${hh}:${mm}:00`, tz);
}
