import { describe, it, expect } from 'vitest';
import { tupleToUnix } from '@/lib/nylas/events';

// Helper: given a Unix timestamp (seconds) and an IANA timezone, return the
// wall-clock hour in that timezone.
function localHour(unix: number, tz: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz })
      .format(new Date(unix * 1000)),
    10,
  );
}

// Helper: return the day-of-week (0=Sun) in a given timezone.
function localDay(unix: number, tz: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz })
      .format(new Date(unix * 1000))
      .replace('Sun', '0').replace('Mon', '1').replace('Tue', '2')
      .replace('Wed', '3').replace('Thu', '4').replace('Fri', '5').replace('Sat', '6'),
    10,
  );
}

describe('tupleToUnix', () => {
  // ── Year correctness (the bug that was fixed) ─────────────────────────────

  it('produces a 2026 timestamp when given start_date=2026-05-06', () => {
    const { startUnix } = tupleToUnix(1, 17, 20, 'America/New_York', '2026-05-06');
    expect(new Date(startUnix * 1000).getUTCFullYear()).toBe(2026);
  });

  it('does NOT produce a pre-2026 timestamp when start_date is null', () => {
    const { startUnix } = tupleToUnix(1, 17, 20, 'America/New_York', null);
    expect(new Date(startUnix * 1000).getUTCFullYear()).toBeGreaterThanOrEqual(2026);
  });

  // ── Hour precision ────────────────────────────────────────────────────────

  it('startUnix resolves to 5pm ET for start=17', () => {
    const { startUnix } = tupleToUnix(1, 17, 20, 'America/New_York', '2026-05-06');
    expect(localHour(startUnix, 'America/New_York')).toBe(17);
  });

  it('endUnix resolves to 8pm ET for end=20', () => {
    const { endUnix } = tupleToUnix(1, 17, 20, 'America/New_York', '2026-05-06');
    expect(localHour(endUnix, 'America/New_York')).toBe(20);
  });

  // ── Day-of-week rounding ──────────────────────────────────────────────────

  it('finds the next Monday when start_date is a Wednesday', () => {
    // 2026-05-06 is Wednesday (day 3); requesting day 1 (Mon) → next Mon is 2026-05-11
    const { startUnix } = tupleToUnix(1, 9, 10, 'America/New_York', '2026-05-06');
    expect(localDay(startUnix, 'America/New_York')).toBe(1);
    expect(new Date(startUnix * 1000).toISOString().slice(0, 10)).toBe('2026-05-11');
  });

  it('uses the same day when start_date already falls on the requested day', () => {
    // 2026-05-11 is a Monday (day 1)
    const { startUnix } = tupleToUnix(1, 9, 10, 'America/New_York', '2026-05-11');
    expect(new Date(startUnix * 1000).toISOString().slice(0, 10)).toBe('2026-05-11');
  });

  // ── Timezone handling ─────────────────────────────────────────────────────

  it('correctly converts a Pacific timezone session to UTC', () => {
    // 2026-05-10 is a Sunday; requesting day 2 (Tue) → 2026-05-12
    // 4pm PT (UTC-7 in May) = 23:00 UTC
    const { startUnix } = tupleToUnix(2, 16, 17, 'America/Los_Angeles', '2026-05-10');
    expect(localHour(startUnix, 'America/Los_Angeles')).toBe(16);
    expect(localDay(startUnix, 'America/Los_Angeles')).toBe(2);
  });
});
