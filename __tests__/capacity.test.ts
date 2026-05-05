import { describe, it, expect } from 'vitest';
import {
  isTutoringSession,
  weekBounds,
  computeWeeklyHours,
  capacityStatus,
  capacityInfo,
  type NylasEventForCapacity,
} from '@/lib/utils/capacity';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal NylasEventForCapacity from human-readable UTC strings. */
function makeEvent(
  title: string,
  startIso: string,
  endIso: string,
  metadata?: Record<string, string>,
): NylasEventForCapacity {
  return {
    title,
    start_time: new Date(startIso).getTime() / 1000,
    end_time:   new Date(endIso).getTime()   / 1000,
    metadata: metadata ?? null,
  };
}

// Monday 2025-01-06 is the reference ISO week used throughout these tests.
const MON = '2025-01-06T00:00:00Z';
const WED = '2025-01-08T10:00:00Z';
const SUN = '2025-01-12T20:00:00Z';
const NEXT_MON = '2025-01-13T00:00:00Z'; // out of week

const monMs = new Date(MON).getTime();

// ── isTutoringSession ──────────────────────────────────────────────────────

describe('isTutoringSession', () => {
  it('returns true when title contains [Tutoring] (exact case)', () => {
    expect(isTutoringSession(makeEvent('[Tutoring] Ava R.', WED, WED))).toBe(true);
  });

  it('returns true when title contains [tutoring] (lower case)', () => {
    expect(isTutoringSession(makeEvent('[tutoring] Ava R.', WED, WED))).toBe(true);
  });

  it('returns true when title contains [TUTORING] (upper case)', () => {
    expect(isTutoringSession(makeEvent('[TUTORING] Ava R.', WED, WED))).toBe(true);
  });

  it('returns true when metadata has simplifi_type = "session"', () => {
    expect(
      isTutoringSession(makeEvent('Team standup', WED, WED, { simplifi_type: 'session' })),
    ).toBe(true);
  });

  it('returns false for a plain calendar event with no metadata', () => {
    expect(isTutoringSession(makeEvent('Dentist appointment', WED, WED))).toBe(false);
  });

  it('returns false when metadata has a different simplifi_type', () => {
    expect(
      isTutoringSession(makeEvent('Hold', WED, WED, { simplifi_type: 'hold' })),
    ).toBe(false);
  });

  it('returns false when title only partially matches (no brackets)', () => {
    expect(isTutoringSession(makeEvent('Tutoring session', WED, WED))).toBe(false);
  });
});

// ── weekBounds ─────────────────────────────────────────────────────────────

describe('weekBounds', () => {
  it('start is Monday 00:00:00.000 UTC for a Wednesday input', () => {
    const { start } = weekBounds(new Date(WED).getTime());
    expect(new Date(start).toISOString()).toBe('2025-01-06T00:00:00.000Z');
  });

  it('end is Sunday 23:59:59.999 UTC for a Wednesday input', () => {
    const { end } = weekBounds(new Date(WED).getTime());
    expect(new Date(end).toISOString()).toBe('2025-01-12T23:59:59.999Z');
  });

  it('start is the same Monday when input is exactly Monday 00:00 UTC', () => {
    const { start } = weekBounds(monMs);
    expect(new Date(start).toISOString()).toBe('2025-01-06T00:00:00.000Z');
  });

  it('start is the same Monday when input is Sunday of that week', () => {
    const { start } = weekBounds(new Date(SUN).getTime());
    expect(new Date(start).toISOString()).toBe('2025-01-06T00:00:00.000Z');
  });

  it('advances to next week when input is the following Monday', () => {
    const { start } = weekBounds(new Date(NEXT_MON).getTime());
    expect(new Date(start).toISOString()).toBe('2025-01-13T00:00:00.000Z');
  });
});

// ── computeWeeklyHours ─────────────────────────────────────────────────────

describe('computeWeeklyHours', () => {
  it('returns 0 for an empty event list', () => {
    expect(computeWeeklyHours([], monMs)).toBe(0);
  });

  it('counts a 2-hour tutoring session in the week', () => {
    const events = [makeEvent('[Tutoring] Ava R.', '2025-01-07T10:00:00Z', '2025-01-07T12:00:00Z')];
    expect(computeWeeklyHours(events, monMs)).toBe(2);
  });

  it('sums multiple sessions in the week', () => {
    const events = [
      makeEvent('[Tutoring] Ava R.',  '2025-01-07T10:00:00Z', '2025-01-07T12:00:00Z'), // 2h
      makeEvent('[Tutoring] Liam C.', '2025-01-09T14:00:00Z', '2025-01-09T15:30:00Z'), // 1.5h
    ];
    expect(computeWeeklyHours(events, monMs)).toBe(3.5);
  });

  it('ignores non-tutoring events', () => {
    const events = [
      makeEvent('[Tutoring] Ava R.', '2025-01-07T10:00:00Z', '2025-01-07T12:00:00Z'), // 2h
      makeEvent('Team standup',       '2025-01-07T09:00:00Z', '2025-01-07T09:30:00Z'), // not tutoring
    ];
    expect(computeWeeklyHours(events, monMs)).toBe(2);
  });

  it('ignores events from the previous week', () => {
    const events = [
      makeEvent('[Tutoring] Old',  '2025-01-05T10:00:00Z', '2025-01-05T12:00:00Z'), // prev week Sun
      makeEvent('[Tutoring] Ava.', '2025-01-07T10:00:00Z', '2025-01-07T11:00:00Z'), // this week
    ];
    expect(computeWeeklyHours(events, monMs)).toBe(1);
  });

  it('ignores events from the following week', () => {
    const events = [
      makeEvent('[Tutoring] Future', '2025-01-13T10:00:00Z', '2025-01-13T12:00:00Z'), // next Mon
      makeEvent('[Tutoring] Ava.',   '2025-01-07T10:00:00Z', '2025-01-07T11:00:00Z'), // this week
    ];
    expect(computeWeeklyHours(events, monMs)).toBe(1);
  });

  it('counts sessions identified by metadata even without [Tutoring] title', () => {
    const events = [
      makeEvent('Oliver G. session', '2025-01-07T15:00:00Z', '2025-01-07T17:00:00Z', {
        simplifi_type: 'session',
      }),
    ];
    expect(computeWeeklyHours(events, monMs)).toBe(2);
  });

  it('rounds to 2 decimal places', () => {
    // 1h 10m = 4200s = 1.1666…h → rounds to 1.17
    const events = [
      makeEvent('[Tutoring] Ava R.', '2025-01-07T10:00:00Z', '2025-01-07T11:10:00Z'),
    ];
    expect(computeWeeklyHours(events, monMs)).toBe(1.17);
  });
});

// ── capacityStatus ─────────────────────────────────────────────────────────

describe('capacityStatus', () => {
  it('returns "ok" when well below 80%', () => {
    expect(capacityStatus(10, 20)).toBe('ok');
  });

  it('returns "near" at exactly 80%', () => {
    expect(capacityStatus(16, 20)).toBe('near');
  });

  it('returns "near" between 80% and 100%', () => {
    expect(capacityStatus(17, 20)).toBe('near');
  });

  it('returns "at" at exactly 100%', () => {
    expect(capacityStatus(20, 20)).toBe('at');
  });

  it('returns "at" when current exceeds max', () => {
    expect(capacityStatus(22, 20)).toBe('at');
  });

  it('returns "ok" at 0 hours', () => {
    expect(capacityStatus(0, 20)).toBe('ok');
  });
});

// ── capacityInfo ───────────────────────────────────────────────────────────

describe('capacityInfo', () => {
  it('returns correct info for a tutor with no sessions this week', () => {
    const info = capacityInfo([], 20, monMs);
    expect(info).toEqual({ current: 0, max: 20, remaining: 20, status: 'ok' });
  });

  it('returns correct info for a tutor near capacity', () => {
    const events = [
      makeEvent('[Tutoring] A', '2025-01-07T10:00:00Z', '2025-01-07T18:00:00Z'), // 8h
      makeEvent('[Tutoring] B', '2025-01-08T10:00:00Z', '2025-01-08T18:00:00Z'), // 8h
    ];
    const info = capacityInfo(events, 20, monMs);
    expect(info.current).toBe(16);
    expect(info.max).toBe(20);
    expect(info.remaining).toBe(4);
    expect(info.status).toBe('near');
  });

  it('returns remaining = 0 and status "at" when at capacity', () => {
    const events = [
      makeEvent('[Tutoring] A', '2025-01-07T10:00:00Z', '2025-01-07T20:00:00Z'), // 10h
      makeEvent('[Tutoring] B', '2025-01-08T10:00:00Z', '2025-01-08T20:00:00Z'), // 10h
    ];
    const info = capacityInfo(events, 20, monMs);
    expect(info.current).toBe(20);
    expect(info.remaining).toBe(0);
    expect(info.status).toBe('at');
  });

  it('clamps remaining to 0 when current exceeds max', () => {
    const events = [
      makeEvent('[Tutoring] A', '2025-01-07T09:00:00Z', '2025-01-07T21:00:00Z'), // 12h
      makeEvent('[Tutoring] B', '2025-01-08T09:00:00Z', '2025-01-08T21:00:00Z'), // 12h
    ];
    const info = capacityInfo(events, 20, monMs);
    expect(info.remaining).toBe(0);
    expect(info.status).toBe('at');
  });
});
