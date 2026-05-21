import { describe, it, expect } from 'vitest';
import { filterTutors, type FilterState } from '@/lib/utils/tutors';
import type { Tutor } from '@/lib/types/domain';

// ── Factories ────────────────────────────────────────────────────────────────

const noFilters: FilterState = {
  q: '',
  subjects: [],
  conf: [],
  tuples: [],
  hideAtCap: false,
  reqId: null,
};

function makeTutor(overrides: Partial<Tutor> = {}): Tutor {
  return {
    id: 'tutor-1',
    initials: 'AT',
    name: 'Alice Tutor',
    email: 'alice@example.com',
    tz: 'America/New_York',
    bio: '',
    personality: '',
    status: 'active',
    subjects: [],
    availability: {},
    hoursCurrent: 0,
    hoursMax: 20,
    hoursMin: 6,
    isPaused: false,
    totalAvailabilityHours: 0,
    availabilityRequests: [],
    ...overrides,
  };
}

// ── Behavior 8: filters combine with AND logic ────────────────────────────

describe('filterTutors — AND logic across filters', () => {
  it('requires tutor to match both subject AND availability filters', () => {
    // Tutor A: right subject, wrong availability
    const tutorA = makeTutor({
      id: 'A',
      subjects: [{ id: 'subj-math', conf: 'HIGH' }],
      availability: { 1: [[9, 12]] },
    });
    // Tutor B: right availability, wrong subject
    const tutorB = makeTutor({
      id: 'B',
      subjects: [{ id: 'subj-science', conf: 'HIGH' }],
      availability: { 1: [[14, 18]] },
    });
    // Tutor C: both match
    const tutorC = makeTutor({
      id: 'C',
      subjects: [{ id: 'subj-math', conf: 'HIGH' }],
      availability: { 1: [[14, 18]] },
    });
    const result = filterTutors([tutorA, tutorB, tutorC], {
      ...noFilters,
      subjects: ['subj-math'],
      conf: ['HIGH'],
      tuples: [{ day: 1, start: 15, end: 17 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('C');
  });
});

// ── Behavior 7: availability tuples ──────────────────────────────────────

describe('filterTutors — availability tuples', () => {
  it('includes a tutor with any overlapping availability window', () => {
    // Tutor available Mon 14–18; filter asks Mon 16–17
    const tutor = makeTutor({ availability: { 1: [[14, 18]] } });
    const result = filterTutors([tutor], { ...noFilters, tuples: [{ day: 1, start: 16, end: 17 }] });
    expect(result).toHaveLength(1);
  });

  it('excludes a tutor with zero availability overlap', () => {
    // Tutor available Mon 9–12; filter asks Mon 16–17
    const tutor = makeTutor({ availability: { 1: [[9, 12]] } });
    const result = filterTutors([tutor], { ...noFilters, tuples: [{ day: 1, start: 16, end: 17 }] });
    expect(result).toHaveLength(0);
  });

  it('includes a tutor who overlaps on any one of multiple tuples (OR logic)', () => {
    // Tutor available Fri 15–19; filter asks Mon 16–17 OR Fri 16–17
    const tutor = makeTutor({ availability: { 5: [[15, 19]] } });
    const result = filterTutors([tutor], {
      ...noFilters,
      tuples: [{ day: 1, start: 16, end: 17 }, { day: 5, start: 16, end: 17 }],
    });
    expect(result).toHaveLength(1);
  });
});

// ── Behavior 6: multiple conf levels act as OR ───────────────────────────

describe('filterTutors — multiple conf levels (OR logic)', () => {
  it('includes a tutor matching any of the selected conf levels', () => {
    const high  = makeTutor({ id: '1', subjects: [{ id: 'subj-math', conf: 'HIGH' }] });
    const medium = makeTutor({ id: '2', subjects: [{ id: 'subj-math', conf: 'MEDIUM' }] });
    const low   = makeTutor({ id: '3', subjects: [{ id: 'subj-math', conf: 'LOW' }] });
    const result = filterTutors([high, medium, low], {
      ...noFilters,
      subjects: ['subj-math'],
      conf: ['HIGH', 'MEDIUM'],
    });
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual(expect.arrayContaining(['1', '2']));
  });
});

// ── Behaviors 4 & 5: subject filter on tutor self-reported conf ───────────

describe('filterTutors — subject filter', () => {
  it('includes a tutor who teaches the subject at the requested conf level', () => {
    const tutor = makeTutor({
      subjects: [{ id: 'subj-math', conf: 'HIGH' }],
    });
    const result = filterTutors([tutor], { ...noFilters, subjects: ['subj-math'], conf: ['HIGH'] });
    expect(result).toHaveLength(1);
  });

  it('excludes a tutor whose conf for the subject does not match the filter', () => {
    const tutor = makeTutor({
      subjects: [{ id: 'subj-math', conf: 'LOW' }],
    });
    const result = filterTutors([tutor], { ...noFilters, subjects: ['subj-math'], conf: ['HIGH'] });
    expect(result).toHaveLength(0);
  });

  it('excludes a tutor who does not teach the subject at all', () => {
    const tutor = makeTutor({
      subjects: [{ id: 'subj-science', conf: 'HIGH' }],
    });
    const result = filterTutors([tutor], { ...noFilters, subjects: ['subj-math'], conf: ['HIGH'] });
    expect(result).toHaveLength(0);
  });
});

// ── Behavior 3: hideAtCap ─────────────────────────────────────────────────

describe('filterTutors — hideAtCap', () => {
  it('includes a tutor exactly at max hours (at-cap is not hidden)', () => {
    const tutor = makeTutor({ hoursCurrent: 20, hoursMax: 20 });
    const result = filterTutors([tutor], { ...noFilters, hideAtCap: true });
    expect(result).toHaveLength(1);
  });

  it('hides a tutor strictly over max hours', () => {
    const tutor = makeTutor({ hoursCurrent: 21, hoursMax: 20 });
    const result = filterTutors([tutor], { ...noFilters, hideAtCap: true });
    expect(result).toHaveLength(0);
  });

  it('includes a tutor under max hours', () => {
    const tutor = makeTutor({ hoursCurrent: 15, hoursMax: 20 });
    const result = filterTutors([tutor], { ...noFilters, hideAtCap: true });
    expect(result).toHaveLength(1);
  });
});

// ── Behavior 2: name search ───────────────────────────────────────────────

describe('filterTutors — name search', () => {
  it('includes tutors whose name contains the query (case-insensitive)', () => {
    const tutors = [makeTutor({ id: '1', name: 'Alice Tutor' }), makeTutor({ id: '2', name: 'Bob Smith' })];
    const result = filterTutors(tutors, { ...noFilters, q: 'alice' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice Tutor');
  });

  it('excludes tutors whose name does not match the query', () => {
    const tutors = [makeTutor({ id: '1', name: 'Alice Tutor' }), makeTutor({ id: '2', name: 'Bob Smith' })];
    const result = filterTutors(tutors, { ...noFilters, q: 'carol' });
    expect(result).toHaveLength(0);
  });
});

// ── Behavior 1: no filters → all tutors returned ──────────────────────────

describe('filterTutors — no filters', () => {
  it('returns all tutors when no filters are active', () => {
    const tutors = [makeTutor({ id: '1' }), makeTutor({ id: '2' }), makeTutor({ id: '3' })];
    expect(filterTutors(tutors, noFilters)).toHaveLength(3);
  });

  it('returns empty array when given no tutors', () => {
    expect(filterTutors([], noFilters)).toHaveLength(0);
  });
});
