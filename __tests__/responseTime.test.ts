import { describe, it, expect } from 'vitest';
import { formatResponseTime, computeLeaderboard } from '@/lib/utils/responseTime';

const MIN = 60_000;
const HR  = 60 * MIN;

describe('computeLeaderboard', () => {
  it('returns an empty map for empty input', () => {
    expect(computeLeaderboard([])).toEqual(new Map());
  });

  it('ranks a tutor with 3 proposals as #1 of 1 with correct average', () => {
    const base = new Date('2025-01-01T10:00:00Z');
    const rows = [1, 2, 3].map(h => ({
      tutorId:    'tutor-a',
      createdAt:  base.toISOString(),
      resolvedAt: new Date(base.getTime() + h * HR).toISOString(),
    }));
    const result = computeLeaderboard(rows);
    const entry  = result.get('tutor-a');
    expect(entry?.rank).toBe(1);
    expect(entry?.totalRanked).toBe(1);
    expect(entry?.count).toBe(3);
    expect(entry?.avgMs).toBeCloseTo(2 * HR); // avg of 1h, 2h, 3h = 2h
  });

  it('gives rank null to a tutor with fewer than 3 proposals but still records avgMs', () => {
    const base = new Date('2025-01-01T10:00:00Z');
    const rows = [1, 2].map(h => ({
      tutorId:    'tutor-b',
      createdAt:  base.toISOString(),
      resolvedAt: new Date(base.getTime() + h * HR).toISOString(),
    }));
    const entry = computeLeaderboard(rows).get('tutor-b');
    expect(entry?.rank).toBeNull();
    expect(entry?.avgMs).toBeCloseTo(1.5 * HR);
    expect(entry?.count).toBe(2);
    expect(entry?.totalRanked).toBe(0);
  });

  it('ranks the faster tutor #1 when two tutors both have 3+ proposals', () => {
    const base = new Date('2025-01-01T10:00:00Z');
    const fast = [1, 2, 3].map(h => ({
      tutorId: 'fast', createdAt: base.toISOString(),
      resolvedAt: new Date(base.getTime() + h * HR).toISOString(),
    }));
    const slow = [5, 6, 7].map(h => ({
      tutorId: 'slow', createdAt: base.toISOString(),
      resolvedAt: new Date(base.getTime() + h * HR).toISOString(),
    }));
    const result = computeLeaderboard([...fast, ...slow]);
    expect(result.get('fast')?.rank).toBe(1);
    expect(result.get('slow')?.rank).toBe(2);
    expect(result.get('fast')?.totalRanked).toBe(2);
    expect(result.get('slow')?.totalRanked).toBe(2);
  });

  it('excludes unranked tutors from totalRanked', () => {
    const base = new Date('2025-01-01T10:00:00Z');
    const ranked = [1, 2, 3].map(h => ({
      tutorId: 'ranked', createdAt: base.toISOString(),
      resolvedAt: new Date(base.getTime() + h * HR).toISOString(),
    }));
    const unranked = [1, 2].map(h => ({
      tutorId: 'unranked', createdAt: base.toISOString(),
      resolvedAt: new Date(base.getTime() + h * HR).toISOString(),
    }));
    const result = computeLeaderboard([...ranked, ...unranked]);
    expect(result.get('ranked')?.totalRanked).toBe(1);
    expect(result.get('unranked')?.totalRanked).toBe(1);
  });

  it('assigns the same rank to tied tutors and skips the next rank', () => {
    const base = new Date('2025-01-01T10:00:00Z');
    // tutor-x and tutor-y both average exactly 2h; tutor-z averages 5h
    const makeRows = (id: string, hours: number[]) =>
      hours.map(h => ({
        tutorId: id, createdAt: base.toISOString(),
        resolvedAt: new Date(base.getTime() + h * HR).toISOString(),
      }));
    const rows = [
      ...makeRows('tutor-x', [1, 2, 3]),   // avg 2h
      ...makeRows('tutor-y', [1, 2, 3]),   // avg 2h
      ...makeRows('tutor-z', [4, 5, 6]),   // avg 5h
    ];
    const result = computeLeaderboard(rows);
    expect(result.get('tutor-x')?.rank).toBe(1);
    expect(result.get('tutor-y')?.rank).toBe(1);
    expect(result.get('tutor-z')?.rank).toBe(3);
  });

  it('records the correct proposal count per tutor', () => {
    const base = new Date('2025-01-01T10:00:00Z');
    const rows = [1, 2, 3, 4, 5].map(h => ({
      tutorId: 'tutor-a', createdAt: base.toISOString(),
      resolvedAt: new Date(base.getTime() + h * HR).toISOString(),
    }));
    expect(computeLeaderboard(rows).get('tutor-a')?.count).toBe(5);
  });
});

describe('formatResponseTime', () => {
  it('formats sub-60-minute durations as whole minutes', () => {
    expect(formatResponseTime(30 * MIN)).toBe('30m');
  });

  it('formats 60 minutes as hours', () => {
    expect(formatResponseTime(60 * MIN)).toBe('1.0h');
  });

  it('formats fractional hours to one decimal place', () => {
    expect(formatResponseTime(1.5 * HR)).toBe('1.5h');
    expect(formatResponseTime(23.9 * HR)).toBe('23.9h');
  });
});
