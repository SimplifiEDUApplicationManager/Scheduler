// lib/nylas/scheduler.ts
// Server-side only — NEVER import from 'use client' files.
//
// Fetch and format Nylas Scheduler v3 configuration for read-only display
// on the tutor settings page.

import { nylasGet, nylasPost } from './client';

// ── Nylas Scheduler config types (v3) ────────────────────────────────────────

type DayName = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

interface AvailabilityWindow {
  days: DayName[];
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  timezone?: string;
}

interface DateSpecificHours {
  date: string;        // "YYYY-MM-DD"
  hours: { start_time: string; end_time: string }[];
}

interface SchedulerConfig {
  id: string;
  availability?: {
    duration_minutes?: number;
    interval_minutes?: number;  // break between sessions
    availability_rules?: {
      availability_windows?: AvailabilityWindow[];
      date_specific_hours?: DateSpecificHours[];
    };
  };
}

// ── Display types ─────────────────────────────────────────────────────────────

export interface SchedulerSummary {
  workingHours: string;                // e.g. "Mon–Fri · 9 am–5 pm"
  exceptions: string;                  // e.g. "2 upcoming · May 3 & May 10"
  breakDuration: string;               // e.g. "15 minutes"
  /** true while the config could not be fetched */
  unavailable?: boolean;
}

// ── Format helpers ────────────────────────────────────────────────────────────

const DAY_ABBR: Record<DayName, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
};

const DAY_ORDER: DayName[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function fmtTime(t: string): string {
  // t is "HH:MM", e.g. "09:00" → "9 am", "17:30" → "5:30 pm"
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function collapseDays(days: DayName[]): string {
  // Sort days by canonical order then collapse contiguous runs into ranges.
  const sorted = [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  if (sorted.length === 0) return '—';
  const runs: DayName[][] = [];
  let run: DayName[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    if (DAY_ORDER.indexOf(sorted[i]!) === DAY_ORDER.indexOf(sorted[i - 1]!) + 1) {
      run.push(sorted[i]!);
    } else {
      runs.push(run);
      run = [sorted[i]!];
    }
  }
  runs.push(run);
  return runs.map(r =>
    r.length === 1 ? DAY_ABBR[r[0]!] :
    r.length === 2 ? `${DAY_ABBR[r[0]!]} & ${DAY_ABBR[r[1]!]}` :
    `${DAY_ABBR[r[0]!]}–${DAY_ABBR[r[r.length - 1]!]}`
  ).join(', ');
}

function fmtWorkingHours(windows: AvailabilityWindow[] | undefined): string {
  if (!windows || windows.length === 0) return '—';
  // Group by start/end time and collapse days within each group.
  const groups = new Map<string, DayName[]>();
  for (const w of windows) {
    const key = `${w.start_time}-${w.end_time}`;
    const existing = groups.get(key) ?? [];
    groups.set(key, [...existing, ...w.days]);
  }
  return [...groups.entries()]
    .map(([key, days]) => {
      const [start, end] = key.split('-');
      return `${collapseDays(days)} · ${fmtTime(start ?? '')}–${fmtTime(end ?? '')}`;
    })
    .join('; ');
}

function fmtBreak(minutes: number | undefined): string {
  if (!minutes) return 'None';
  // Snap to the nearest supported denomination (5, 10, 15, 20, 30, 45, 60).
  const denoms = [5, 10, 15, 20, 30, 45, 60];
  const snapped = denoms.reduce((prev, cur) =>
    Math.abs(cur - minutes) < Math.abs(prev - minutes) ? cur : prev,
  );
  return `${snapped} minute${snapped === 1 ? '' : 's'}`;
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtExceptions(dateHours: DateSpecificHours[] | undefined): string {
  if (!dateHours || dateHours.length === 0) return 'None';
  // Only count dates where hours is empty (full-day block).
  const today = new Date();
  const upcoming = dateHours
    .filter(d => d.hours.length === 0)
    .map(d => new Date(d.date + 'T00:00:00'))
    .filter(d => d >= today)
    .sort((a, b) => a.getTime() - b.getTime());
  if (upcoming.length === 0) return 'None upcoming';
  const preview = upcoming.slice(0, 2).map(d => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`).join(' & ');
  return upcoming.length > 2 ? `${upcoming.length} upcoming · ${preview}…` : `${upcoming.length} upcoming · ${preview}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a Nylas Scheduler configuration and format it for display.
 * Returns a summary with `unavailable: true` on any fetch failure.
 */
export async function fetchSchedulerSummary(configId: string): Promise<SchedulerSummary> {
  const result = await nylasGet<SchedulerConfig>(`/v3/scheduling/configurations/${configId}`);
  if (!result.ok) {
    console.error('[nylas/scheduler] Failed to fetch config:', result.error);
    return { workingHours: '—', exceptions: '—', breakDuration: '—', unavailable: true };
  }

  const cfg = result.data;
  const rules = cfg.availability?.availability_rules;

  return {
    workingHours: fmtWorkingHours(rules?.availability_windows),
    exceptions:   fmtExceptions(rules?.date_specific_hours),
    breakDuration: fmtBreak(cfg.availability?.interval_minutes),
  };
}

// ── Edit session ──────────────────────────────────────────────────────────────

interface SchedulingSession {
  session_id: string;
  url: string;
}

/**
 * Mint a short-lived Nylas Scheduler edit session for the given configuration.
 * Returns the edit URL, or null on failure.
 */
export async function mintSchedulerEditUrl(configId: string): Promise<string | null> {
  const result = await nylasPost<SchedulingSession>(
    '/v3/scheduling/sessions',
    { configuration_id: configId },
  );
  if (!result.ok) {
    console.error('[nylas/scheduler] Failed to mint session:', result.error);
    return null;
  }
  return result.data.url;
}
