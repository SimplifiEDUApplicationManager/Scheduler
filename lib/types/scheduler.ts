// Shared types for scheduler preferences — used by the API route and the modal UI.

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface TimeWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export type HoursMap = Record<DayKey, TimeWindow[]>;

export interface SchedulerException {
  date: string;           // "YYYY-MM-DD"
  windows: TimeWindow[];  // empty = unavailable all day
}

export interface SchedulerPrefs {
  hours: HoursMap;
  exceptions: SchedulerException[];
  cushionMin: number;
}

export const EMPTY_HOURS_MAP: HoursMap = {
  sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [],
};

export const DAY_ORDER: [DayKey, string][] = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'],
  ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
];
