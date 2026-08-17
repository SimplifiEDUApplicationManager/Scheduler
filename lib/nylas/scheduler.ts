// lib/nylas/scheduler.ts
// Server-side only — NEVER import from 'use client' files.
//
// Fetch and format Nylas Scheduler v3 configuration for read-only display
// on the tutor settings page.

import { nylasGet, nylasPost, nylasPut, nylasPatch, nylasDelete } from './client';

// ── Nylas Scheduler config types (v3) ────────────────────────────────────────
//
// Nylas uses integer day indices (0=Sunday … 6=Saturday) and `start`/`end`
// field names (not `start_time`/`end_time`) inside `default_open_hours`.
// Exceptions live either in `exdates` per open-hours entry (all-day blocks)
// or in `participants[].specific_time_availability` (partial-day overrides).

// 0=Sunday, 1=Monday, … 6=Saturday
export interface OpenHours {
  days: number[];
  start: string;       // "HH:MM"
  end: string;         // "HH:MM"
  timezone?: string;
  exdates?: string[];  // "YYYY-MM-DD" dates to exclude from this rule
}

type SpecificTimeAvailability = { date: string; start: string; end: string };

interface SchedulerConfig {
  id: string;
  participants?: Array<{
    specific_time_availability?: SpecificTimeAvailability[];
    [key: string]: unknown;
  }>;
  availability?: {
    duration_minutes?: number;
    interval_minutes?: number;
    availability_rules?: {
      default_open_hours?: OpenHours[];
      [key: string]: unknown;
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

const DAY_NUM_ABBR: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

export function fmtTime(t: string): string {
  // t is "HH:MM", e.g. "09:00" → "9 am", "17:30" → "5:30 pm"
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function collapseDayNums(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 0) return '—';
  const runs: number[][] = [];
  let run: number[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! === sorted[i - 1]! + 1) {
      run.push(sorted[i]!);
    } else {
      runs.push(run);
      run = [sorted[i]!];
    }
  }
  runs.push(run);
  return runs.map(r =>
    r.length === 1 ? DAY_NUM_ABBR[r[0]!] :
    r.length === 2 ? `${DAY_NUM_ABBR[r[0]!]} & ${DAY_NUM_ABBR[r[1]!]}` :
    `${DAY_NUM_ABBR[r[0]!]}–${DAY_NUM_ABBR[r[r.length - 1]!]}`
  ).join(', ');
}

export function fmtWorkingHours(windows: OpenHours[] | undefined): string {
  if (!windows || windows.length === 0) return '—';
  // Group by start/end time and collapse days within each group.
  const groups = new Map<string, number[]>();
  for (const w of windows) {
    const key = `${w.start}-${w.end}`;
    const existing = groups.get(key) ?? [];
    groups.set(key, [...existing, ...w.days]);
  }
  return [...groups.entries()]
    .map(([key, days]) => {
      const dashIdx = key.indexOf('-', 3); // skip past "HH:" to find the separator dash
      const start = key.slice(0, dashIdx);
      const end = key.slice(dashIdx + 1);
      return `${collapseDayNums(days)} · ${fmtTime(start)}–${fmtTime(end)}`;
    })
    .join('; ');
}

export function fmtBreak(minutes: number | undefined): string {
  if (!minutes) return 'None';
  // Snap to the nearest supported denomination (5, 10, 15, 20, 30, 45, 60).
  const denoms = [5, 10, 15, 20, 30, 45, 60];
  const snapped = denoms.reduce((prev, cur) =>
    Math.abs(cur - minutes) < Math.abs(prev - minutes) ? cur : prev,
  );
  return `${snapped} minute${snapped === 1 ? '' : 's'}`;
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Takes a flat list of exception date strings ("YYYY-MM-DD") from both
// exdates and specific_time_availability, deduplicates, and formats.
export function fmtExceptions(dates: string[] | undefined): string {
  if (!dates || dates.length === 0) return 'None';
  const today = new Date();
  const upcoming = [...new Set(dates)]
    .map(d => new Date(d + 'T00:00:00'))
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
export async function fetchSchedulerSummary(configId: string, grantId: string): Promise<SchedulerSummary> {
  const result = await nylasGet<SchedulerConfig>(`/v3/grants/${grantId}/scheduling/configurations/${configId}`);
  if (!result.ok) {
    console.error('[nylas/scheduler] Failed to fetch config:', result.error);
    return { workingHours: '—', exceptions: '—', breakDuration: '—', unavailable: true };
  }

  const cfg = result.data;
  const rules = cfg.availability?.availability_rules;
  const openHours = rules?.default_open_hours ?? [];

  // Collect all exception dates: exdates from open-hours entries (all-day
  // blocks) + specific_time_availability dates (partial-day overrides).
  const exdates = openHours.flatMap(h => h.exdates ?? []);
  const partialDates = (cfg.participants?.[0]?.specific_time_availability ?? []).map(s => s.date);
  const allExceptionDates = [...new Set([...exdates, ...partialDates])];

  return {
    workingHours:  fmtWorkingHours(openHours),
    exceptions:    fmtExceptions(allExceptionDates),
    breakDuration: fmtBreak(cfg.availability?.interval_minutes),
  };
}

// ── Edit session ──────────────────────────────────────────────────────────────

interface SchedulingSession {
  session_id: string;
  url: string;
}

interface CreatedConfig {
  id: string;
}

interface NylasGrant {
  id: string;
  email: string;
  provider: string;
}

/**
 * Fetch the canonical email address for a Nylas grant.
 * Gmail (and other providers) normalize + aliases to the base address on OAuth,
 * so the grant email may differ from the Supabase user email.
 * Returns null on failure.
 */
export async function fetchGrantEmail(grantId: string): Promise<string | null> {
  const result = await nylasGet<NylasGrant>(`/v3/grants/${grantId}`);
  if (!result.ok) {
    console.error('[nylas/scheduler] Failed to fetch grant:', result.error);
    return null;
  }
  return result.data.email ?? null;
}

/**
 * Mint a short-lived Nylas Scheduler edit session for the given configuration.
 * Returns { url } on success or { url: null, error, configGone, sessionAuthDisabled, participantMismatch } on failure.
 *
 * sessionAuthDisabled is true when the config exists but was created without
 * requires_session_auth: true. Call enableSchedulerSessionAuth then retry.
 *
 * participantMismatch is true when the grant email does not match any
 * participant in the config (e.g. Supabase email was a Gmail + alias).
 * Call patchSchedulerParticipantEmail then retry.
 */
export async function mintSchedulerEditUrl(
  configId: string,
): Promise<{ url: string } | { url: null; error: string; configGone: boolean; sessionAuthDisabled: boolean; participantMismatch: boolean }> {
  const result = await nylasPost<SchedulingSession>(
    '/v3/scheduling/sessions',
    { configuration_id: configId },
  );
  if (!result.ok) {
    console.error('[nylas/scheduler] Failed to mint session:', result.error);
    const lower = result.error.toLowerCase();
    const sessionAuthDisabled = lower.includes('session');
    const participantMismatch = lower.includes('participant');
    return { url: null, error: result.error, configGone: result.statusCode === 404, sessionAuthDisabled, participantMismatch };
  }
  return { url: result.data.url };
}

/**
 * Patch an existing Nylas Scheduler configuration to update the participant
 * email to the canonical grant email. Used when a tutor's Supabase email
 * differs from their OAuth grant email (e.g. Gmail + aliases).
 * Also sets requires_session_auth: true so edit sessions can be minted.
 *
 * Returns true on success.
 */
export async function patchSchedulerParticipantEmail(
  configId: string,
  grantId: string,
  canonicalEmail: string,
): Promise<boolean> {
  const current = await nylasGet<Record<string, unknown>>(
    `/v3/grants/${grantId}/scheduling/configurations/${configId}`,
  );
  if (!current.ok) {
    console.error('[nylas/scheduler] patchSchedulerParticipantEmail GET failed:', current.statusCode, current.error);
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, updated_at: _ua, ...body } = current.data;
  const participants = body.participants as Array<Record<string, unknown>> | undefined;
  if (!participants || participants.length === 0) {
    console.error('[nylas/scheduler] patchSchedulerParticipantEmail: no participants in config');
    return false;
  }
  const updatedParticipants = participants.map(p => ({ ...p, email: canonicalEmail }));
  const updated = await nylasPut<CreatedConfig>(
    `/v3/grants/${grantId}/scheduling/configurations/${configId}`,
    { ...body, participants: updatedParticipants, requires_session_auth: true },
  );
  if (!updated.ok) {
    console.error('[nylas/scheduler] patchSchedulerParticipantEmail PUT failed:', updated.statusCode, updated.error);
  }
  return updated.ok;
}

/**
 * Patches an existing Nylas Scheduler configuration to enable session-based
 * editing (requires_session_auth: true). Fetches the current config first so
 * the PUT preserves all existing tutor customisations.
 *
 * Returns true on success.
 */
export async function enableSchedulerSessionAuth(configId: string, grantId: string): Promise<boolean> {
  // Nylas v3 Scheduler API only supports PUT (full replace) — not PATCH.
  // Fetch the existing config as an opaque record, strip the server-managed
  // read-only fields, then PUT it back with requires_session_auth: true.
  const current = await nylasGet<Record<string, unknown>>(
    `/v3/grants/${grantId}/scheduling/configurations/${configId}`,
  );
  if (!current.ok) {
    console.error('[nylas/scheduler] enableSchedulerSessionAuth GET failed:', current.statusCode, current.error);
    return false;
  }
  if (!current.data || typeof current.data !== 'object') {
    console.error('[nylas/scheduler] enableSchedulerSessionAuth: unexpected GET response shape');
    return false;
  }
  // Omit fields Nylas rejects in a PUT body.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, updated_at: _ua, ...body } = current.data;
  const updated = await nylasPut<CreatedConfig>(
    `/v3/grants/${grantId}/scheduling/configurations/${configId}`,
    { ...body, requires_session_auth: true },
  );
  if (!updated.ok) {
    console.error('[nylas/scheduler] enableSchedulerSessionAuth PUT failed:', updated.statusCode, updated.error);
  }
  return updated.ok;
}

/**
 * Create a minimal Nylas Scheduler configuration for a tutor.
 * Returns { configId, bookingUrl } on success or null on failure.
 *
 * The tutor can customise working hours, capacity, etc. through the hosted
 * editor once the configuration exists.
 */
export async function createSchedulerConfig(params: {
  tutorName: string;
  tutorEmail: string;
  timezone: string;
  grantId: string;
  meetingLink?: string;
  openHours?: Array<{ days: number[]; start: string; end: string }>;
  cushionMinutes?: number;
}): Promise<{ configId: string; bookingUrl: string } | { configId: null; error: string }> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://simplifischedule.app').replace(/\/$/, '');

  // Slug: derived from email local-part (unique per tutor), alphanumeric + hyphens only.
  // Used as the path segment in the booking URL: <appUrl>/book/<slug>
  const slug = params.tutorEmail.split('@')[0]!.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const result = await nylasPost<CreatedConfig>(`/v3/grants/${params.grantId}/scheduling/configurations`, {
    requires_session_auth: false,
    slug,
    participants: [{
      name: params.tutorName,
      email: params.tutorEmail,
      is_organizer: true,
      availability: { calendar_ids: ['primary'] },
      booking:      { calendar_id: 'primary' },
    }],
    availability: {
      duration_minutes: 60,
      interval_minutes: params.cushionMinutes ?? 0,
      ...(params.openHours && params.openHours.length > 0
        ? {
            availability_rules: {
              default_open_hours: params.openHours.map(h => ({
                days:     h.days,
                start:    h.start,
                end:      h.end,
                timezone: params.timezone || 'America/New_York',
              })),
            },
          }
        : {}),
    },
    event_booking: {
      title: 'Tutoring Session',
      timezone: params.timezone || 'America/New_York',
      ...(params.meetingLink ? { location: params.meetingLink } : {}),
    },
  });

  // If slug already exists (e.g. tutor reconnected calendar), delete the old
  // config and retry once.
  if (!result.ok && result.error?.toLowerCase().includes('slug already exists')) {
    const listResult = await nylasGet<{ id: string; slug?: string }[]>(
      `/v3/grants/${params.grantId}/scheduling/configurations`,
    );
    if (listResult.ok) {
      const configs = Array.isArray(listResult.data) ? listResult.data : [];
      const stale = configs.find(c => c.slug === slug);
      if (stale) {
        await nylasDelete(`/v3/grants/${params.grantId}/scheduling/configurations/${stale.id}`);
        const retry = await nylasPost<CreatedConfig>(`/v3/grants/${params.grantId}/scheduling/configurations`, {
          requires_session_auth: false,
          slug,
          participants: [{
            name: params.tutorName,
            email: params.tutorEmail,
            is_organizer: true,
            availability: { calendar_ids: ['primary'] },
            booking:      { calendar_id: 'primary' },
          }],
          availability: {
            duration_minutes: 60,
            interval_minutes: params.cushionMinutes ?? 0,
            ...(params.openHours && params.openHours.length > 0
              ? {
                  availability_rules: {
                    default_open_hours: params.openHours.map(h => ({
                      days:     h.days,
                      start:    h.start,
                      end:      h.end,
                      timezone: params.timezone || 'America/New_York',
                    })),
                  },
                }
              : {}),
          },
          event_booking: {
            title: 'Tutoring Session',
            timezone: params.timezone || 'America/New_York',
            ...(params.meetingLink ? { location: params.meetingLink } : {}),
          },
        });
        if (retry.ok) {
          return { configId: retry.data.id, bookingUrl: `${appUrl}/book/${slug}` };
        }
        console.error('[nylas/scheduler] Retry after slug cleanup failed:', retry.statusCode, retry.error);
        return { configId: null, error: retry.error };
      }
    }
  }

  if (!result.ok) {
    console.error('[nylas/scheduler] Failed to create config:', result.statusCode, result.error);
    return { configId: null, error: result.error };
  }

  const configId = result.data.id;
  return { configId, bookingUrl: `${appUrl}/book/${slug}` };
}
