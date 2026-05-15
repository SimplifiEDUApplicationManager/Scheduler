import { describe, it, expect } from 'vitest';
import { overlapsTuple, overlapHours } from '@/lib/utils/tutors';
import type { Availability, Tuple } from '@/lib/types/domain';

// ── Behaviors 5–8: overlapHours ──────────────────────────────────────────

describe('overlapHours — single tuple', () => {
  it('returns 0 when there is no overlap', () => {
    const availability: Availability = { 1: [[9, 12]] };
    expect(overlapHours(availability, [{ day: 1, start: 14, end: 16 }])).toBe(0);
  });

  it('returns 1 for a partial overlap (session is 1hr regardless of window width)', () => {
    const availability: Availability = { 1: [[14, 18]] };
    expect(overlapHours(availability, [{ day: 1, start: 16, end: 20 }])).toBe(1);
  });

  it('returns 1 when tutor window fully contains the tuple', () => {
    const availability: Availability = { 1: [[10, 20]] };
    expect(overlapHours(availability, [{ day: 1, start: 14, end: 16 }])).toBe(1);
  });
});

describe('overlapHours — multiple tuples', () => {
  it('counts 1 per matching tuple across multiple days', () => {
    // Mon and Fri each overlap → 2 sessions = 2h
    const availability: Availability = { 1: [[14, 18]], 5: [[9, 12]] };
    const tuples: Tuple[] = [
      { day: 1, start: 15, end: 17 },
      { day: 5, start: 10, end: 13 },
    ];
    expect(overlapHours(availability, tuples)).toBe(2);
  });

  it('returns 0 for an empty tuples array', () => {
    const availability: Availability = { 1: [[14, 18]] };
    expect(overlapHours(availability, [])).toBe(0);
  });
});

describe('overlapHours — counts 1 per tuple regardless of window width', () => {
  it('returns 1 even when the tuple spans many hours', () => {
    const availability: Availability = { 1: [[14, 17 + 1 / 3]] };
    const result = overlapHours(availability, [{ day: 1, start: 14, end: 17 + 1 / 3 }]);
    expect(result).toBe(1);
  });
});

// ── Behaviors 2 & 3: no overlap ──────────────────────────────────────────

describe('overlapsTuple — no overlap', () => {
  it('returns false when windows are adjacent (touching but not overlapping)', () => {
    // Tutor ends at 14, tuple starts at 14 — touching, not overlapping
    const availability: Availability = { 1: [[10, 14]] };
    const tuple: Tuple = { day: 1, start: 14, end: 16 };
    expect(overlapsTuple(availability, tuple)).toBe(false);
  });

  it('returns false when tutor window is entirely before the tuple', () => {
    const availability: Availability = { 1: [[9, 12]] };
    const tuple: Tuple = { day: 1, start: 14, end: 16 };
    expect(overlapsTuple(availability, tuple)).toBe(false);
  });

  it('returns false when tutor window is entirely after the tuple', () => {
    const availability: Availability = { 1: [[18, 20]] };
    const tuple: Tuple = { day: 1, start: 14, end: 16 };
    expect(overlapsTuple(availability, tuple)).toBe(false);
  });

  it('returns false when tutor has no availability on the requested day', () => {
    const availability: Availability = { 2: [[14, 18]] }; // Wednesday only
    const tuple: Tuple = { day: 1, start: 14, end: 18 };  // Monday
    expect(overlapsTuple(availability, tuple)).toBe(false);
  });

  it('returns false when availability is empty', () => {
    const availability: Availability = {};
    const tuple: Tuple = { day: 1, start: 14, end: 18 };
    expect(overlapsTuple(availability, tuple)).toBe(false);
  });
});

// ── Behavior 4: multiple windows on the day ───────────────────────────────

describe('overlapsTuple — multiple windows', () => {
  it('returns true when any one window on the day overlaps', () => {
    const availability: Availability = { 1: [[9, 12], [15, 19]] };
    const tuple: Tuple = { day: 1, start: 16, end: 18 };
    expect(overlapsTuple(availability, tuple)).toBe(true);
  });

  it('returns false when multiple windows exist but none overlap', () => {
    const availability: Availability = { 1: [[9, 12], [20, 22]] };
    const tuple: Tuple = { day: 1, start: 14, end: 18 };
    expect(overlapsTuple(availability, tuple)).toBe(false);
  });
});

// ── Behavior 1: overlapsTuple — overlap exists ────────────────────────────

describe('overlapsTuple — overlap exists', () => {
  it('returns true when the tutor window fully contains the requested tuple', () => {
    const availability: Availability = { 1: [[14, 18]] };
    const tuple: Tuple = { day: 1, start: 15, end: 17 };
    expect(overlapsTuple(availability, tuple)).toBe(true);
  });

  it('returns true when the tutor window partially overlaps from the left', () => {
    const availability: Availability = { 1: [[14, 16]] };
    const tuple: Tuple = { day: 1, start: 15, end: 18 };
    expect(overlapsTuple(availability, tuple)).toBe(true);
  });

  it('returns true when the tutor window partially overlaps from the right', () => {
    const availability: Availability = { 1: [[16, 19]] };
    const tuple: Tuple = { day: 1, start: 14, end: 17 };
    expect(overlapsTuple(availability, tuple)).toBe(true);
  });
});
