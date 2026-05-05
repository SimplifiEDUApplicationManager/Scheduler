import { describe, it, expect } from 'vitest';
import {
  tupleToUtcRange,
  formatInTz,
  formatDecimalHour,
} from '@/lib/utils/timezone';
import type { Tuple } from '@/lib/data/dashboard-mock';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Monday 00:00:00 UTC for the given ISO date string (must be a Monday). */
function mondayMs(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getTime();
}

// Reference weeks:
//
//   2025-03-03 (Mon) — the week BEFORE ET spring forward (Mar 9 @ 2 am → 3 am)
//     Mon–Sat are in EST (UTC-5); Sun Mar 9 is the transition day.
//
//   2025-03-10 (Mon) — first full week in EDT (UTC-4)
//
//   2025-11-03 (Mon) — first full week in EST after fall-back (Nov 2 @ 2 am → 1 am)
//
const WINTER_MON = mondayMs('2025-03-03'); // pre-spring-forward week
const SUMMER_MON = mondayMs('2025-03-10'); // post-spring-forward week
const FALLBACK_MON = mondayMs('2025-11-03'); // post-fall-back week

const ET = 'America/New_York';
const PT = 'America/Los_Angeles';

// ── formatDecimalHour ──────────────────────────────────────────────────────

describe('formatDecimalHour', () => {
  it('formats an on-the-hour afternoon value', () => {
    expect(formatDecimalHour(16)).toBe('4:00 PM');
  });

  it('formats a half-hour value', () => {
    expect(formatDecimalHour(17.5)).toBe('5:30 PM');
  });

  it('formats a quarter-hour value', () => {
    expect(formatDecimalHour(9.25)).toBe('9:15 AM');
  });

  it('formats midnight as 12:00 AM', () => {
    expect(formatDecimalHour(0)).toBe('12:00 AM');
  });

  it('formats noon as 12:00 PM', () => {
    expect(formatDecimalHour(12)).toBe('12:00 PM');
  });

  it('formats 11:59 PM correctly', () => {
    // 23 + 59/60 ≈ 23.9833
    expect(formatDecimalHour(23 + 59 / 60)).toBe('11:59 PM');
  });

  it('formats 10:00 AM', () => {
    expect(formatDecimalHour(10)).toBe('10:00 AM');
  });
});

// ── tupleToUtcRange — day-of-week placement ────────────────────────────────

describe('tupleToUtcRange — day placement', () => {
  // Use a fixed summer week so offset is constant (EDT = UTC-4)
  // SUMMER_MON = 2025-03-10 00:00 UTC  →  Mon Mar 10
  // day 1 (Mon) 17:00 EDT = Mon Mar 10 21:00 UTC
  // day 2 (Tue) 17:00 EDT = Tue Mar 11 21:00 UTC
  // day 5 (Fri) 17:00 EDT = Fri Mar 14 21:00 UTC
  // day 0 (Sun) 17:00 EDT = Sun Mar 16 21:00 UTC
  // day 6 (Sat) 17:00 EDT = Sat Mar 15 21:00 UTC

  const t: Tuple = { day: 1, start: 17, end: 19 }; // Mon 5–7 PM

  it('places day=1 (Mon) on the correct calendar day', () => {
    const { start } = tupleToUtcRange(t, SUMMER_MON, ET);
    expect(start.toISOString()).toBe('2025-03-10T21:00:00.000Z');
  });

  it('places day=2 (Tue) one day after Monday', () => {
    const { start } = tupleToUtcRange({ ...t, day: 2 }, SUMMER_MON, ET);
    expect(start.toISOString()).toBe('2025-03-11T21:00:00.000Z');
  });

  it('places day=5 (Fri) four days after Monday', () => {
    const { start } = tupleToUtcRange({ ...t, day: 5 }, SUMMER_MON, ET);
    expect(start.toISOString()).toBe('2025-03-14T21:00:00.000Z');
  });

  it('places day=6 (Sat) five days after Monday', () => {
    const { start } = tupleToUtcRange({ ...t, day: 6 }, SUMMER_MON, ET);
    expect(start.toISOString()).toBe('2025-03-15T21:00:00.000Z');
  });

  it('places day=0 (Sun) six days after Monday', () => {
    const { start } = tupleToUtcRange({ ...t, day: 0 }, SUMMER_MON, ET);
    expect(start.toISOString()).toBe('2025-03-16T21:00:00.000Z');
  });
});

// ── tupleToUtcRange — DST: spring forward (ET Mar 9 2025) ─────────────────

describe('tupleToUtcRange — DST spring forward', () => {
  // Before spring forward: Mon Mar 3 5PM is in EST (UTC-5) → 22:00 UTC
  // After spring forward:  Mon Mar 10 5PM is in EDT (UTC-4) → 21:00 UTC
  const tueMon: Tuple = { day: 1, start: 17, end: 19 }; // Mon 5–7 PM ET

  it('winter Mon 5 PM ET → UTC-5 offset (22:00 UTC)', () => {
    const { start } = tupleToUtcRange(tueMon, WINTER_MON, ET);
    expect(start.toISOString()).toBe('2025-03-03T22:00:00.000Z');
  });

  it('summer Mon 5 PM ET → UTC-4 offset (21:00 UTC)', () => {
    const { start } = tupleToUtcRange(tueMon, SUMMER_MON, ET);
    expect(start.toISOString()).toBe('2025-03-10T21:00:00.000Z');
  });

  it('end time is offset by the declared duration', () => {
    const { start, end } = tupleToUtcRange(tueMon, SUMMER_MON, ET);
    const durationHours = (end.getTime() - start.getTime()) / 3_600_000;
    expect(durationHours).toBe(2);
  });

  it('DST transition day (Sun Mar 9) — day=0 at 10 AM resolves as EDT (UTC-4)', () => {
    // Spring forward: clocks advance at 2 AM → 3 AM on Mar 9.
    // 10 AM is after the transition, so already EDT (UTC-4) → 14:00 UTC.
    const { start } = tupleToUtcRange({ day: 0, start: 10, end: 12 }, WINTER_MON, ET);
    expect(start.toISOString()).toBe('2025-03-09T14:00:00.000Z');
  });
});

// ── tupleToUtcRange — DST: fall back (ET Nov 2 2025) ──────────────────────

describe('tupleToUtcRange — DST fall back', () => {
  // Fall back occurred Nov 2 @ 2 AM → 1 AM.
  // Week of Nov 3 (Mon) is now in EST (UTC-5).
  const tueMon: Tuple = { day: 1, start: 17, end: 19 }; // Mon 5–7 PM

  it('post-fall-back Mon 5 PM ET → UTC-5 offset (22:00 UTC)', () => {
    const { start } = tupleToUtcRange(tueMon, FALLBACK_MON, ET);
    expect(start.toISOString()).toBe('2025-11-03T22:00:00.000Z');
  });

  it('summer (pre-fall-back) Mon 5 PM ET → UTC-4 offset', () => {
    // Oct 27 is still in EDT
    const summerMon = mondayMs('2025-10-27');
    const { start } = tupleToUtcRange(tueMon, summerMon, ET);
    expect(start.toISOString()).toBe('2025-10-27T21:00:00.000Z');
  });
});

// ── tupleToUtcRange — Pacific timezone ────────────────────────────────────

describe('tupleToUtcRange — Pacific time (PT)', () => {
  // PT in winter = UTC-8; Mon Mar 10 is also first day of PDT (UTC-7).
  // Week of 2025-01-06 (Mon): PST (UTC-8)
  // Tue Jan 7 3 PM PST → 23:00 UTC
  it('Tue 3 PM PST → 23:00 UTC', () => {
    const weekMon = mondayMs('2025-01-06');
    const { start } = tupleToUtcRange({ day: 2, start: 15, end: 17 }, weekMon, PT);
    expect(start.toISOString()).toBe('2025-01-07T23:00:00.000Z');
  });

  it('end time is correct for a 2h session', () => {
    const weekMon = mondayMs('2025-01-06');
    const { end } = tupleToUtcRange({ day: 2, start: 15, end: 17 }, weekMon, PT);
    expect(end.toISOString()).toBe('2025-01-08T01:00:00.000Z');
  });
});

// ── tupleToUtcRange — half-hour start times ───────────────────────────────

describe('tupleToUtcRange — decimal (half-hour) start', () => {
  it('17.5 (5:30 PM EDT) → correct UTC', () => {
    const { start } = tupleToUtcRange({ day: 2, start: 17.5, end: 19.5 }, SUMMER_MON, ET);
    // Tue Mar 11 5:30 PM EDT = 21:30 UTC
    expect(start.toISOString()).toBe('2025-03-11T21:30:00.000Z');
  });
});

// ── formatInTz ─────────────────────────────────────────────────────────────

describe('formatInTz', () => {
  // 2025-03-11T21:00:00Z = Tue Mar 11 5:00 PM EDT
  const utcMs = new Date('2025-03-11T21:00:00Z').getTime();

  it('formats with default pattern in ET', () => {
    const result = formatInTz(utcMs, ET);
    expect(result).toMatch(/^5:00 PM/);
  });

  it('formats with a custom date+time pattern', () => {
    const result = formatInTz(utcMs, ET, 'yyyy-MM-dd HH:mm');
    expect(result).toBe('2025-03-11 17:00');
  });

  it('formats a winter UTC timestamp as EST', () => {
    // 2025-01-07T22:00:00Z = Tue Jan 7 5:00 PM EST
    const winterMs = new Date('2025-01-07T22:00:00Z').getTime();
    const result = formatInTz(winterMs, ET, 'HH:mm zzz');
    expect(result).toBe('17:00 EST');
  });

  it('formats a summer UTC timestamp as EDT', () => {
    const result = formatInTz(utcMs, ET, 'HH:mm zzz');
    expect(result).toBe('17:00 EDT');
  });
});
