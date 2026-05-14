import { describe, it, expect } from 'vitest';
import {
  tupleToUtcRange,
  formatInTz,
  formatDecimalHour,
  convertTupleTimezone,
} from '@/lib/utils/timezone';
import type { Tuple } from '@/lib/types/domain';

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

// ── convertTupleTimezone ────────────────────────────────────────────────────

describe('convertTupleTimezone — identity', () => {
  it('returns an equal tuple when fromTz equals toTz', () => {
    const t = { day: 1, start: 17, end: 19 };
    expect(convertTupleTimezone(t, ET, ET)).toEqual(t);
  });
});

describe('convertTupleTimezone — cross-timezone conversion', () => {
  // Mon 5–7 PM ET (UTC-5 in winter) = Mon 2–4 PM PT (UTC-8 in winter)
  it('shifts hours when converting ET → PT (Mon 5pm ET → Mon 2pm PT)', () => {
    const result = convertTupleTimezone({ day: 1, start: 17, end: 19 }, ET, PT);
    expect(result.day).toBe(1);           // still Monday
    expect(result.start).toBeCloseTo(14); // 2 PM PT
    expect(result.end).toBeCloseTo(16);   // 4 PM PT
  });

  it('shifts hours when converting PT → ET (Mon 2pm PT → Mon 5pm ET)', () => {
    const result = convertTupleTimezone({ day: 1, start: 14, end: 16 }, PT, ET);
    expect(result.day).toBe(1);
    expect(result.start).toBeCloseTo(17);
    expect(result.end).toBeCloseTo(19);
  });

  it('rolls the day back when early-morning ET crosses midnight going west (Mon 1am ET → Sun 10pm PT)', () => {
    const result = convertTupleTimezone({ day: 1, start: 1, end: 2 }, ET, PT);
    expect(result.day).toBe(0);           // Sunday
    expect(result.start).toBeCloseTo(22); // 10 PM PT
    expect(result.end).toBeCloseTo(23);   // 11 PM PT
  });

  it('works for non-US timezone pairs (ET → London winter, UTC+0)', () => {
    // Mon 12pm ET (UTC-5) = Mon 5pm UTC
    const result = convertTupleTimezone({ day: 1, start: 12, end: 13 }, ET, 'Europe/London');
    expect(result.day).toBe(1);
    expect(result.start).toBeCloseTo(17);
    expect(result.end).toBeCloseTo(18);
  });

  it('works for large offsets (ET → Tokyo, UTC+9)', () => {
    // Mon 12pm ET (UTC-5) = Tue 2am JST (UTC+9, offset=14h)
    const result = convertTupleTimezone({ day: 1, start: 12, end: 13 }, ET, 'Asia/Tokyo');
    expect(result.day).toBe(2);           // Tuesday
    expect(result.start).toBeCloseTo(2);  // 2 AM JST
    expect(result.end).toBeCloseTo(3);    // 3 AM JST
  });

  it('produces end > start (not end < start) when session crosses midnight in toTz', () => {
    // Mon 11 PM – Tue 12 AM ET (UTC-5 winter) = Mon 8 PM – 9 PM PT. No midnight cross here.
    // Use a case that actually crosses midnight: Sat 11 PM PT → Sun 12 AM PT, converted to ET
    // Sat 11 PM PT (UTC-8) = Sun 2 AM ET (UTC-5) → day=0 (Sun), start=2, end=3 -- no cross still
    // For a genuine cross-midnight: Mon 10 PM – Tue 1 AM ET converted to UTC+9 (Tokyo)
    // Mon 10 PM ET (UTC-5) = Tue 3 AM Tokyo (UTC+9), Mon 11 PM ET = Tue 4 AM, Mon midnight ET = Tue 5 AM
    // But we need end to cross midnight *in* toTz.
    // Mon 11 PM ET → Tue 1 AM ET (2h session) converted to Tokyo (UTC+9):
    // Mon 11 PM ET = Tue 4 AM JST, Tue 1 AM ET = Tue 6 AM JST — no midnight cross in JST
    // The midnight-cross-in-toTz scenario: something like PT → UTC+2 where a late-night slot flips
    // Sat 10 PM PT → Sun 12:30 AM PT (2.5h session) converted to ET (UTC-5 winter):
    // Sat 10 PM PT (UTC-8) = Sun 1 AM ET (UTC-5). Sun 12:30 AM PT = Sun 3:30 AM ET -- no cross
    // Genuine case: Mon 10 PM – Tue 0:30 AM in PT, converted to ET:
    // 10 PM PT = 1 AM ET Tuesday, 0:30 AM PT = 3:30 AM ET Tuesday -- both same day Tuesday, no cross
    // The real midnight-crossing scenario in toTz: Sun 10 PM PT → Mon 0:30 AM PT:
    // Sun 10 PM PT (UTC-8) = Mon 6 AM UTC, Mon 0:30 AM PT = Mon 8:30 AM UTC
    // In ET (UTC-5): Mon 1 AM and Mon 3:30 AM — day=1, start=1, end=3.5 -- no cross
    //
    // The cleanest way to trigger midnight-in-toTz: ET 10 PM → ET 1 AM converted to UTC+12:
    // ET 10 PM (UTC-5) = UTC+3:00, which in UTC+12 = 3 AM+12 = next day
    // Let's use: Mon 10 PM ET (UTC-5 winter) → Mon midnight ET → Tue 2 AM ET (4h session)
    // In UTC+14 (Pacific/Kiritimati):
    // Mon 10 PM ET = Tue 11 AM Kiritimati (UTC+14), Tue 2 AM ET = Tue 3 PM Kiritimati
    // All on Tuesday — no midnight cross.
    //
    // Actual triggering case: a long eastward shift. Mon 11 PM – Tue 1 AM ET to UTC+12:
    // Mon 11 PM ET (UTC-5) = Tue 4 AM UTC+12. Tue 1 AM ET = Tue 6 AM UTC+12. No cross.
    //
    // Actually crossing midnight in toTz requires a westward shift where toTz is behind fromTz
    // AND the session straddles local midnight in toTz.
    // ET Mon 2 AM – 4 AM → PT (UTC-8): Sun 11 PM – Mon 1 AM PT
    // In PT: start=23 (Sunday), end=1 (Monday next day)
    // day is derived from utcStart in PT → Sunday (day=0), start=23, end=1 → end < start!
    const result = convertTupleTimezone({ day: 1, start: 2, end: 4 }, ET, PT);
    // Mon 2 AM ET (UTC-5) = Sun 11 PM PT (UTC-8) → day=0 (Sun), start=23
    // Mon 4 AM ET (UTC-5) = Mon 1 AM PT (UTC-8) → end=1 in PT, but end < start would give 25
    expect(result.end).toBeGreaterThan(result.start); // must never produce end < start
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
