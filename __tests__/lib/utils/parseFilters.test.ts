import { describe, it, expect } from 'vitest';
import { parseFilters, filtersToParams, DEFAULT_CONF, type FilterState } from '@/lib/utils/tutors';

const emptyParams = new URLSearchParams();

// ── Behavior 7: full round-trip ──────────────────────────────────────────

describe('parseFilters / filtersToParams — full round-trip', () => {
  it('round-trips a non-trivial FilterState through params', () => {
    const original: FilterState = {
      q: 'alice',
      subjects: ['subj-1', 'subj-2'],
      conf: ['HIGH'],
      tuples: [{ day: 1, start: 14, end: 18 }, { day: 5, start: 9, end: 11 }],
      hideAtCap: false,
      reqId: 'req-xyz',
    };
    const result = parseFilters(filtersToParams(original));
    expect(result).toEqual(original);
  });

  it('round-trips the default FilterState', () => {
    const defaults: FilterState = {
      q: '',
      subjects: [],
      conf: DEFAULT_CONF,
      tuples: [],
      hideAtCap: true,
      reqId: null,
    };
    expect(parseFilters(filtersToParams(defaults))).toEqual(defaults);
  });
});

// ── Behavior 5: valid tuple parsing ──────────────────────────────────────

describe('parseFilters — valid tuples', () => {
  it('parses a valid tuple string into a Tuple object', () => {
    const params = new URLSearchParams('tuple=1:14:18');
    expect(parseFilters(params).tuples).toEqual([{ day: 1, start: 14, end: 18 }]);
  });

  it('parses multiple tuples', () => {
    const params = new URLSearchParams('tuple=1:9:12&tuple=5:15:19');
    expect(parseFilters(params).tuples).toEqual([
      { day: 1, start: 9, end: 12 },
      { day: 5, start: 15, end: 19 },
    ]);
  });

  it('serialises a tuple as day:start:end', () => {
    const f: FilterState = { q: '', subjects: [], conf: DEFAULT_CONF, tuples: [{ day: 2, start: 10, end: 12 }], hideAtCap: true, reqId: null };
    expect(filtersToParams(f).getAll('tuple')).toEqual(['2:10:12']);
  });
});

// ── Behavior 6: invalid tuples silently dropped ───────────────────────────

describe('parseFilters — invalid tuples dropped', () => {
  it('drops a tuple where day > 6', () => {
    expect(parseFilters(new URLSearchParams('tuple=7:10:12')).tuples).toHaveLength(0);
  });

  it('drops a tuple where day < 0', () => {
    expect(parseFilters(new URLSearchParams('tuple=-1:10:12')).tuples).toHaveLength(0);
  });

  it('drops a tuple where end equals start', () => {
    expect(parseFilters(new URLSearchParams('tuple=1:10:10')).tuples).toHaveLength(0);
  });

  it('drops a tuple where end is less than start', () => {
    expect(parseFilters(new URLSearchParams('tuple=1:12:10')).tuples).toHaveLength(0);
  });

  it('drops a tuple with non-numeric parts', () => {
    expect(parseFilters(new URLSearchParams('tuple=mon:10:12')).tuples).toHaveLength(0);
  });

  it('drops a tuple with the wrong number of parts', () => {
    expect(parseFilters(new URLSearchParams('tuple=1:10')).tuples).toHaveLength(0);
  });

  it('keeps valid tuples from a mixed list', () => {
    const params = new URLSearchParams('tuple=1:10:12&tuple=7:10:12&tuple=3:15:17');
    const tuples = parseFilters(params).tuples;
    expect(tuples).toHaveLength(2);
    expect(tuples).toEqual([{ day: 1, start: 10, end: 12 }, { day: 3, start: 15, end: 17 }]);
  });
});

// ── Behaviors 3 & 4: conf default omission and non-default round-trip ─────

describe('filtersToParams — conf', () => {
  it('omits conf params when conf matches the default', () => {
    const params = filtersToParams({ q: '', subjects: [], conf: ['HIGH', 'MEDIUM'], tuples: [], hideAtCap: true, reqId: null });
    expect(params.getAll('conf')).toHaveLength(0);
  });

  it('omits conf params even when default values are in different order', () => {
    const params = filtersToParams({ q: '', subjects: [], conf: ['MEDIUM', 'HIGH'], tuples: [], hideAtCap: true, reqId: null });
    expect(params.getAll('conf')).toHaveLength(0);
  });

  it('writes conf params when they differ from the default', () => {
    const params = filtersToParams({ q: '', subjects: [], conf: ['HIGH'], tuples: [], hideAtCap: true, reqId: null });
    expect(params.getAll('conf')).toEqual(['HIGH']);
  });
});

describe('parseFilters — conf', () => {
  it('returns DEFAULT_CONF when no conf params are present', () => {
    expect(parseFilters(emptyParams).conf).toEqual(DEFAULT_CONF);
  });

  it('returns the explicit conf values when present', () => {
    const params = new URLSearchParams('conf=HIGH&conf=LOW');
    expect(parseFilters(params).conf).toEqual(['HIGH', 'LOW']);
  });
});

// ── Behavior 2: hideAtCap ─────────────────────────────────────────────────

describe('parseFilters — hideAtCap', () => {
  it('defaults to true when cap param is absent', () => {
    expect(parseFilters(emptyParams).hideAtCap).toBe(true);
  });

  it('is false when cap=0', () => {
    expect(parseFilters(new URLSearchParams('cap=0')).hideAtCap).toBe(false);
  });

  it('is true for any cap value other than 0', () => {
    expect(parseFilters(new URLSearchParams('cap=1')).hideAtCap).toBe(true);
  });
});

describe('filtersToParams — hideAtCap', () => {
  it('omits cap param when hideAtCap is true', () => {
    const params = filtersToParams({ q: '', subjects: [], conf: DEFAULT_CONF, tuples: [], hideAtCap: true, reqId: null });
    expect(params.get('cap')).toBeNull();
  });

  it('sets cap=0 when hideAtCap is false', () => {
    const params = filtersToParams({ q: '', subjects: [], conf: DEFAULT_CONF, tuples: [], hideAtCap: false, reqId: null });
    expect(params.get('cap')).toBe('0');
  });
});

// ── Behavior 1: empty params → default FilterState ────────────────────────

describe('parseFilters — empty params', () => {
  it('returns the default filter state when no params are present', () => {
    const result = parseFilters(emptyParams);
    expect(result).toEqual<FilterState>({
      q: '',
      subjects: [],
      conf: DEFAULT_CONF,
      tuples: [],
      hideAtCap: true,
      reqId: null,
    });
  });
});
