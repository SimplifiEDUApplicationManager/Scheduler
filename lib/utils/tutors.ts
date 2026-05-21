import type { Availability, Tuple, Tutor } from '@/lib/types/domain';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export { DAY_NAMES, DAY_NAMES_FULL };

/** Returns true if the tutor has any availability window overlapping the given tuple. */
export function overlapsTuple(availability: Availability, tuple: Tuple): boolean {
  const windows = availability[tuple.day] ?? [];
  return windows.some(([ws, we]) => ws < tuple.end && we > tuple.start);
}

/**
 * Returns the number of weekly hours a tutor would take on from a set of request tuples.
 *
 * Each tuple represents a student's availability window for one weekly session.
 * Sessions are 1 hour each, once per week — so each tuple that overlaps the
 * tutor's availability contributes exactly 1 hour regardless of window width.
 */
export function overlapHours(availability: Availability, tuples: Tuple[]): number {
  let total = 0;
  for (const tuple of tuples) {
    const overlaps = (availability[tuple.day] ?? []).some(
      ([ws, we]) => ws < tuple.end && we > tuple.start,
    );
    if (overlaps) total += 1;
  }
  return total;
}

/** Formats a decimal hour as 12h time, e.g. 16 → "4:00 PM", 9.5 → "9:30 AM".
 *  Accepts values ≥ 24 for sessions that cross midnight (e.g. 25 → "1 AM"). */
export function fmtHour(h: number): string {
  const mins = Math.round((h % 1) * 60);
  const hour = Math.floor(h % 24); // normalise cross-midnight values
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

// ── Filter predicate ───────────────────────────────────────────────────────

/**
 * Apply FilterState to a list of tutors and return the matching subset.
 * Pure function — no React, no Supabase. Safe to call from both the client
 * component (useMemo) and server-side skills (/filter).
 */
export function filterTutors(tutors: Tutor[], filters: FilterState): Tutor[] {
  return tutors.filter(t => {
    if (filters.q && !t.name.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.subjects.length > 0) {
      const hasMatch = t.subjects.some(
        ts => filters.subjects.includes(ts.id) && filters.conf.includes(ts.conf),
      );
      if (!hasMatch) return false;
    }
    if (filters.tuples.length > 0) {
      const anyMatch = filters.tuples.some(tp => overlapsTuple(t.availability, tp));
      if (!anyMatch) return false;
    }
    return true;
  });
}

// ── URL param serialization ────────────────────────────────────────────────

export interface FilterState {
  q: string;
  subjects: string[];
  conf: string[];
  tuples: Tuple[];
  reqId: string | null;
}

export const DEFAULT_CONF = ['HIGH', 'MEDIUM'];

export function parseFilters(params: URLSearchParams): FilterState {
  const confRaw = params.getAll('conf');
  return {
    q:         params.get('q') ?? '',
    subjects:  params.getAll('subject'),
    conf:      params.has('conf') ? confRaw.filter(Boolean) : DEFAULT_CONF,
    tuples:    params.getAll('tuple').map(parseTuple).filter((t): t is Tuple => t !== null),
    reqId:     params.get('req'),
  };
}

export function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  f.subjects.forEach(s => p.append('subject', s));
  if (f.conf.length > 0) {
    f.conf.forEach(c => p.append('conf', c));
  } else {
    p.set('conf', ''); // sentinel: conf explicitly cleared (deselect-all)
  }
  f.tuples.forEach(t => p.append('tuple', `${t.day}:${t.start}:${t.end}`));
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

// ── Calendar helpers ───────────────────────────────────────────────────────

export interface WeekDay {
  dow: string;
  date: number;
  month: number;
  year: number;
  dayIdx: number;
  today: boolean;
}

export interface MonthCell {
  date: number;
  month: number;
  year: number;
  dayIdx: number;
  today: boolean;
  inMonth: boolean;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

/** Returns the 7 days of the week at `weekOffset` weeks from today (Sun–Sat). */
export function getWeekDays(weekOffset: number): WeekDay[] {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() + weekOffset * 7);
  sunday.setHours(0, 0, 0, 0);
  const todayStr = new Date().toDateString();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return {
      dow: DAY_NAMES[i],
      date: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
      dayIdx: i,
      today: d.toDateString() === todayStr,
    };
  });
}

/** Returns cells for a calendar month grid including leading/trailing padding. */
export function getMonthDays(monthOffset: number): MonthCell[] {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toDateString();
  const cells: MonthCell[] = [];
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, month, 1 - (firstDow - i));
    cells.push({ date: d.getDate(), month: d.getMonth(), year: d.getFullYear(), dayIdx: d.getDay(), today: false, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ date: d, month, year, dayIdx: date.getDay(), today: date.toDateString() === todayStr, inMonth: true });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    cells.push({ date: d.getDate(), month: d.getMonth(), year: d.getFullYear(), dayIdx: d.getDay(), today: false, inMonth: false });
  }
  return cells;
}

/** "April 2026" */
export function getMonthLabel(monthOffset: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  return `${MONTH_NAMES[target.getMonth()]} ${target.getFullYear()}`;
}

/** "Apr 27 – May 3, 2026" */
export function getWeekLabel(weekOffset: number): string {
  const days = getWeekDays(weekOffset);
  const sun = days[0];
  const sat = days[6];
  const fmt = (d: WeekDay) => `${MONTH_NAMES[d.month].slice(0, 3)} ${d.date}`;
  return `${fmt(sun)} – ${fmt(sat)}, ${sat.year}`;
}
