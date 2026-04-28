import type { Availability, Tuple } from '@/lib/data/dashboard-mock';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export { DAY_NAMES, DAY_NAMES_FULL };

/** Returns true if the tutor has any availability window overlapping the given tuple. */
export function overlapsTuple(availability: Availability, tuple: Tuple): boolean {
  const windows = availability[tuple.day] ?? [];
  return windows.some(([ws, we]) => ws < tuple.end && we > tuple.start);
}

/** Returns total overlap hours between a tutor's availability and a set of tuples. */
export function overlapHours(availability: Availability, tuples: Tuple[]): number {
  let total = 0;
  for (const tuple of tuples) {
    for (const [ws, we] of availability[tuple.day] ?? []) {
      const s = Math.max(ws, tuple.start);
      const e = Math.min(we, tuple.end);
      if (e > s) total += e - s;
    }
  }
  return Math.round(total * 10) / 10;
}

/** Formats a decimal hour as 12h time, e.g. 16 → "4:00 PM", 9.5 → "9:30 AM". */
export function fmtHour(h: number): string {
  const mins = Math.round((h % 1) * 60);
  const hour = Math.floor(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return mins === 0 ? `${h12} ${suffix}` : `${h12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** Formats a time range, e.g. 16–19 → "4–7 PM". */
export function fmtRange(start: number, end: number): string {
  const s = fmtHour(start);
  const e = fmtHour(end);
  // If same period (AM/PM), omit period from start
  const [sTime, sPeriod] = s.split(' ');
  const [eTime, ePeriod] = e.split(' ');
  if (sPeriod === ePeriod) return `${sTime}–${eTime} ${ePeriod}`;
  return `${s}–${e}`;
}

// ── URL param serialization ────────────────────────────────────────────────

export interface FilterState {
  q: string;
  subjects: string[];
  conf: string[];
  tuples: Tuple[];
  hideAtCap: boolean;
  reqId: string | null;
}

export const DEFAULT_CONF = ['HIGH', 'MEDIUM'];

export function parseFilters(params: URLSearchParams): FilterState {
  const confRaw = params.getAll('conf');
  return {
    q:         params.get('q') ?? '',
    subjects:  params.getAll('subject'),
    conf:      confRaw.length > 0 ? confRaw : DEFAULT_CONF,
    tuples:    params.getAll('tuple').map(parseTuple).filter((t): t is Tuple => t !== null),
    hideAtCap: params.get('cap') !== '0',
    reqId:     params.get('req'),
  };
}

export function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  f.subjects.forEach(s => p.append('subject', s));
  // Only write conf if it differs from default
  const sortedConf = [...f.conf].sort().join(',');
  const sortedDefault = [...DEFAULT_CONF].sort().join(',');
  if (sortedConf !== sortedDefault) {
    f.conf.forEach(c => p.append('conf', c));
  }
  f.tuples.forEach(t => p.append('tuple', `${t.day}:${t.start}:${t.end}`));
  if (!f.hideAtCap) p.set('cap', '0');
  if (f.reqId) p.set('req', f.reqId);
  return p;
}

function parseTuple(raw: string): Tuple | null {
  const parts = raw.split(':').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [day, start, end] = parts;
  if (day < 0 || day > 6 || start < 0 || end <= start) return null;
  return { day, start, end };
}
