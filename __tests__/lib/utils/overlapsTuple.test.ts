import { describe, it, expect } from 'vitest';
import { overlapsTuple, overlapHours } from '@/lib/utils/tutors';
import type { Availability, Tuple } from '@/lib/types/domain';

// ── Behaviors 5–8: overlapHours ──────────────────────────────────────────

describe('overlapHours — single tuple', () => {
  it('returns 0 when there is no overlap', () => {
    const availability: Availability = { 1: [[9, 12]] };
    expect(overlapHours(availability, [{ day: 1, start: 14, end: 16 }])).toBe(0);
  });

  it('calculates the overlapping portion of a partial overlap', () => {
    // Tutor 14–18, tuple 16–20 → overlap is 16–18 = 2h
    const availability: Availability = { 1: [[14, 18]] };
    expect(overlapHours(availability, [{ day: 1, start: 16, end: 20 }])).toBe(2);
  });

  it('returns the full tuple duration when tutor window fully contains it', () => {
    // Tutor 10–20, tuple 14–16 → overlap is 14–16 = 2h
    const availability: Availability = { 1: [[10, 20]] };
    expect(overlapHours(availability, [{ day: 1, start: 14, end: 16 }])).toBe(2);
  });
});

describe('overlapHours — multiple tuples', () => {
  it('sums overlap across multiple tuples on different days', () => {
    // Mon 14–18 overlap with 15–17 = 2h, Fri 9–12 overlap with 10–13 = 2h → 4h
    const availability: Availability = { 1: [[14, 18]], 5: [[9, 12]] };
    const tuples: Tuple[] = [
      { day: 1, start: 15, end: 17 },
      { day: 5, start: 10, end: 13 },
    ];
    expect(overlapHours(availability, tuples)).toBe(4);
  });

  it('returns 0 for an empty tuples array', () => {
    const availability: Availability = { 1: [[14, 18]] };
    expect(overlapHours(availability, [])).toBe(0);
  });
});

describe('overlapHours — rounding', () => {
  it('rounds to 1 decimal place', () => {
    // Tutor 14–17.333, tuple 14–17.333 → overlap = 3.333h → rounds to 3.3
    const availability: Availability = { 1: [[14, 17 + 1 / 3]] };
    const result = overlapHours(availability, [{ day: 1, start: 14, end: 17 + 1 / 3 }]);
    expect(result).toBe(3.3);
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
