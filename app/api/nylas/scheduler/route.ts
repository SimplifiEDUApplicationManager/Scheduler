import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { nylasGet, nylasPut } from '@/lib/nylas/client';
import { createSchedulerConfig, fetchGrantEmail, fmtWorkingHours, fmtBreak, fmtExceptions } from '@/lib/nylas/scheduler';
import type { SchedulerSummary, OpenHours } from '@/lib/nylas/scheduler';
import type { DayKey, HoursMap, SchedulerException, SchedulerPrefs } from '@/lib/types/scheduler';
import { EMPTY_HOURS_MAP } from '@/lib/types/scheduler';
import type { Json } from '@/lib/types/database';

// ── Nylas ↔ SchedulerPrefs conversions ──────────────────────────────────────
//
// Nylas `default_open_hours` format:
//   { days: number[], start: "HH:MM", end: "HH:MM", timezone: string, exdates?: string[] }
//   Days: 0=Sunday, 1=Monday, … 6=Saturday
//
// Partial-day exceptions live in participants[0].specific_time_availability:
//   [{ date: "YYYY-MM-DD", start: "HH:MM", end: "HH:MM" }]

type SpecificTimeEntry = { date: string; start: string; end: string };

const DAY_NUM_TO_KEY: Record<number, DayKey> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};
const KEY_TO_DAY_NUM: Record<DayKey, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Convert a HoursMap to the Availability format used by the coordinator
 * matcher: Record<dayNumber, [startDecimalHour, endDecimalHour][]>.
 * Stored on users.availability so filterTutors() can run client-side.
 */
function hoursMapToAvailability(hours: HoursMap): Record<number, [number, number][]> {
  const result: Record<number, [number, number][]> = {};
  for (const [k, windows] of Object.entries(hours) as [DayKey, { start: string; end: string }[]][]) {
    if (windows.length === 0) continue;
    const dayNum = KEY_TO_DAY_NUM[k];
    result[dayNum] = windows.map(w => {
      const [sh, sm] = w.start.split(':').map(Number);
      const [eh, em] = w.end.split(':').map(Number);
      return [sh! + sm! / 60, eh! + em! / 60] as [number, number];
    });
  }
  return result;
}

function fromDefaultOpenHours(openHours: OpenHours[]): HoursMap {
  const map: HoursMap = { sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] };
  for (const h of openHours) {
    for (const day of h.days) {
      const key = DAY_NUM_TO_KEY[day];
      if (key) map[key].push({ start: h.start, end: h.end });
    }
  }
  // Reconstruct cross-midnight windows: if day X ends at 23:59 and day X+1
  // starts at 00:00, merge them into a single cross-midnight window on day X.
  const dayKeys: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  for (let i = 0; i < 7; i++) {
    const key = dayKeys[i];
    const nextKey = dayKeys[(i + 1) % 7];
    const lateWindows = map[key].filter(w => w.end === '23:59');
    const earlyWindows = map[nextKey].filter(w => w.start === '00:00');
    for (const late of lateWindows) {
      const match = earlyWindows.find(e => e.start === '00:00');
      if (match) {
        // Merge: extend the current-day window past midnight
        const endMins = timeStrToMins(match.end) + 24 * 60;
        const endH = Math.floor(endMins / 60);
        const endM = endMins % 60;
        late.end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        // Remove the next-day early window
        map[nextKey] = map[nextKey].filter(w => w !== match);
      }
    }
  }
  return map;
}

function toDefaultOpenHours(hours: HoursMap, timezone: string, allDayBlockDates: string[]): OpenHours[] {
  // Expand each day's windows, splitting cross-midnight windows into two
  // Nylas entries (Nylas requires start < end within 00:00–24:00).
  const entries: { day: number; start: string; end: string }[] = [];
  for (const [k, windows] of Object.entries(hours) as [DayKey, HoursMap[DayKey]][]) {
    const dayNum = KEY_TO_DAY_NUM[k];
    for (const w of windows) {
      const endMins = timeStrToMins(w.end);
      if (endMins > 24 * 60) {
        // Split: current day start → 23:59, next day 00:00 → remainder
        entries.push({ day: dayNum, start: w.start, end: '23:59' });
        const nextDay = (dayNum + 1) % 7;
        const remH = Math.floor((endMins - 24 * 60) / 60);
        const remM = (endMins - 24 * 60) % 60;
        const remEnd = `${String(remH).padStart(2, '0')}:${String(remM).padStart(2, '0')}`;
        entries.push({ day: nextDay, start: '00:00', end: remEnd });
      } else {
        entries.push({ day: dayNum, start: w.start, end: w.end });
      }
    }
  }

  // Group entries that share the same start/end time into one Nylas entry.
  const groups = new Map<string, number[]>();
  for (const e of entries) {
    const key = `${e.start}|${e.end}`;
    groups.set(key, [...(groups.get(key) ?? []), e.day]);
  }
  return [...groups.entries()].map(([key, days]) => {
    const [start, end] = key.split('|') as [string, string];
    return {
      days: [...new Set(days)],
      start,
      end,
      timezone,
      ...(allDayBlockDates.length > 0 ? { exdates: allDayBlockDates } : {}),
    };
  });
}

function timeStrToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fromPartialExceptions(participants: Record<string, unknown>[]): SchedulerException[] {
  const specific = (participants[0]?.specific_time_availability ?? []) as SpecificTimeEntry[];
  const byDate = new Map<string, { start: string; end: string }[]>();
  for (const s of specific) {
    const windows = byDate.get(s.date) ?? [];
    windows.push({ start: s.start, end: s.end });
    byDate.set(s.date, windows);
  }
  return [...byDate.entries()].map(([date, windows]) => ({ date, windows }));
}

function fromAllDayExceptions(openHours: OpenHours[]): SchedulerException[] {
  const dates = new Set<string>(openHours.flatMap(h => h.exdates ?? []));
  return [...dates].map(date => ({ date, windows: [] }));
}

// ── GET — fetch current scheduler preferences ────────────────────────────────

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { data: row } = await supabase
      .from('users')
      .select('email, nylas_grant_id, nylas_scheduler_config_id, availability')
      .eq('id', user.id)
      .single();

    const defaults: SchedulerPrefs = { hours: { ...EMPTY_HOURS_MAP }, exceptions: [], cushionMin: 0 };

    // Roshni can use the modal without a connected calendar — reconstruct
    // HoursMap from the stored availability (decimal-hour format) if present.
    const isCalendarOptional = ['truax@berkeley.edu', 'trevorregister@gmail.com'].includes((row?.email as string | null) ?? '');
    if (!row?.nylas_grant_id && isCalendarOptional) {
      const stored = row?.availability as Record<number, [number, number][]> | null;
      if (!stored) return NextResponse.json(defaults);
      const hours: HoursMap = { ...EMPTY_HOURS_MAP };
      for (const [dayNum, windows] of Object.entries(stored)) {
        const key = DAY_NUM_TO_KEY[Number(dayNum)];
        if (!key) continue;
        hours[key] = (windows as [number, number][]).map(([s, e]) => ({
          start: `${String(Math.floor(s)).padStart(2, '0')}:${String(Math.round((s % 1) * 60)).padStart(2, '0')}`,
          end:   `${String(Math.floor(e)).padStart(2, '0')}:${String(Math.round((e % 1) * 60)).padStart(2, '0')}`,
        }));
      }
      return NextResponse.json({ hours, exceptions: [], cushionMin: 0 });
    }

    if (!row?.nylas_grant_id || !row?.nylas_scheduler_config_id) {
      return NextResponse.json(defaults);
    }

    const result = await nylasGet<Record<string, unknown>>(
      `/v3/grants/${row.nylas_grant_id}/scheduling/configurations/${row.nylas_scheduler_config_id}`,
    );
    // Config no longer exists in Nylas — clear the stale ID and return empty
    // defaults. The modal will then prompt the tutor to save, which recreates it.
    if (!result.ok && result.statusCode === 404) {
      await supabase
        .from('users')
        .update({ nylas_scheduler_config_id: null })
        .eq('id', user.id);
      return NextResponse.json(defaults);
    }
    if (!result.ok) return NextResponse.json({ error: 'Failed to load scheduling preferences' }, { status: 502 });

    const avail = result.data.availability as Record<string, unknown> | undefined;
    const rules = avail?.availability_rules as Record<string, unknown> | undefined;
    const openHours = (rules?.default_open_hours ?? []) as OpenHours[];
    const participants = (result.data.participants ?? []) as Record<string, unknown>[];

    const allDayExceptions = fromAllDayExceptions(openHours);
    const partialExceptions = fromPartialExceptions(participants);

    // Merge: partial-day exceptions take precedence over all-day blocks for
    // the same date (a partial override is more specific than a full block).
    const partialDates = new Set(partialExceptions.map(e => e.date));
    const mergedExceptions = [
      ...allDayExceptions.filter(e => !partialDates.has(e.date)),
      ...partialExceptions,
    ].sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      hours:      fromDefaultOpenHours(openHours),
      exceptions: mergedExceptions,
      cushionMin: (avail?.interval_minutes as number | undefined) ?? 0,
    });
  } catch (err) {
    console.error('[api/nylas/scheduler GET]', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeTotalWeeklyHours(hours: HoursMap): number {
  let total = 0;
  for (const windows of Object.values(hours)) {
    for (const w of windows) {
      const [sh, sm] = w.start.split(':').map(Number);
      const [eh, em] = w.end.split(':').map(Number);
      total += (eh! * 60 + em!) - (sh! * 60 + sm!);
    }
  }
  return total / 60;
}

// ── PUT — save scheduler preferences ────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const body = await request.json() as Partial<SchedulerPrefs>;
    const hours = body.hours ?? { ...EMPTY_HOURS_MAP };
    const exceptions = body.exceptions ?? [];
    const cushionMin = body.cushionMin ?? 0;

    const totalHours = computeTotalWeeklyHours(hours);

    const { data: row } = await supabase
      .from('users')
      .select('name, email, timezone, meeting_link, nylas_grant_id, nylas_scheduler_config_id')
      .eq('id', user.id)
      .single();

    // Roshni can save availability without a connected calendar — store hours
    // in the database for coordinator matching but skip all Nylas operations.
    const isCalendarOptional = ['truax@berkeley.edu', 'trevorregister@gmail.com'].includes((row?.email as string | null) ?? '');

    if (!row?.nylas_grant_id && !isCalendarOptional) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    if (!row?.nylas_grant_id && isCalendarOptional) {
      const availabilityMap = hoursMapToAvailability(hours);
      const workingHoursFmt = fmtWorkingHours(toDefaultOpenHours(hours, (row?.timezone as string | null) ?? 'America/New_York', []));

      await Promise.all([
        supabase
          .from('users')
          .update({
            total_availability_hours: totalHours,
            availability: availabilityMap as unknown as Json,
          })
          .eq('id', user.id),
        supabase.from('tutor_availability_activity').insert({
          tutor_id:   user.id,
          event_type: 'scheduling_prefs_updated',
          summary:    `Scheduling preferences updated · ${workingHoursFmt}`,
          details:    { working_hours: workingHoursFmt, total_hours: totalHours },
        }),
      ]);

      const summary: SchedulerSummary = {
        workingHours:  workingHoursFmt,
        exceptions:    '—',
        breakDuration: '—',
      };
      return NextResponse.json({ ok: true, summary });
    }

    const timezone = (row.timezone as string | null) ?? 'America/New_York';
    let configId = row.nylas_scheduler_config_id as string | null;

    // Use the canonical email from the Nylas grant as the participant email.
    // Supabase may store a + alias (e.g. austin+tutor@simplifiedu.com) that
    // Google normalises on OAuth, causing a mismatch against the grant email.
    const grantEmail = await fetchGrantEmail(row.nylas_grant_id as string);
    const tutorEmail = (grantEmail ?? row.email) as string;

    // Create config if it doesn't exist yet.
    if (!configId) {
      const created = await createSchedulerConfig({
        tutorName:   row.name as string,
        tutorEmail,
        timezone,
        grantId:     row.nylas_grant_id as string,
        meetingLink: (row.meeting_link as string | null) ?? undefined,
      });
      if (created.configId === null) {
        return NextResponse.json({ error: created.error, status: 502 }, { status: 502 });
      }
      configId = created.configId;
      await supabase
        .from('users')
        .update({ nylas_scheduler_config_id: configId, booking_page_url: created.bookingUrl })
        .eq('id', user.id);
    }

    // GET the full current config (opaque), then PUT back with updated availability.
    // If the config was deleted in Nylas (404), recreate it first.
    let current = await nylasGet<Record<string, unknown>>(
      `/v3/grants/${row.nylas_grant_id}/scheduling/configurations/${configId}`,
    );
    if (!current.ok && current.statusCode === 404) {
      const recreated = await createSchedulerConfig({
        tutorName:   row.name as string,
        tutorEmail,
        timezone,
        grantId:     row.nylas_grant_id as string,
        meetingLink: (row.meeting_link as string | null) ?? undefined,
      });
      if (recreated.configId === null) {
        return NextResponse.json({ error: recreated.error }, { status: 502 });
      }
      configId = recreated.configId;
      await supabase
        .from('users')
        .update({ nylas_scheduler_config_id: configId, booking_page_url: recreated.bookingUrl })
        .eq('id', user.id);
      current = await nylasGet<Record<string, unknown>>(
        `/v3/grants/${row.nylas_grant_id}/scheduling/configurations/${configId}`,
      );
    }
    if (!current.ok) {
      return NextResponse.json({ error: current.error, status: 502 }, { status: 502 });
    }

    const { id: _id, created_at: _ca, updated_at: _ua, ...cfg } = current.data;
    const existingAvail = (cfg.availability ?? {}) as Record<string, unknown>;
    const existingRules = (existingAvail.availability_rules ?? {}) as Record<string, unknown>;

    // Split exceptions into all-day blocks (→ exdates) and partial-day
    // overrides (→ participants[].specific_time_availability).
    const allDayDates  = exceptions.filter(e => e.windows.length === 0).map(e => e.date);
    const partialExceptions = exceptions.filter(e => e.windows.length > 0);
    const specificTimeAvailability: SpecificTimeEntry[] = partialExceptions.flatMap(e =>
      e.windows.map(w => ({ date: e.date, start: w.start, end: w.end })),
    );

    const openHours = toDefaultOpenHours(hours, timezone, allDayDates);

    // Update participants to carry partial-day exceptions.
    // If the config has no participants (created by an older code path), rebuild
    // a default one from the tutor's grant info — Nylas rejects a PUT with an
    // empty participants array with "must be associated with at least one participant".
    const existingParticipants = (cfg.participants ?? []) as Record<string, unknown>[];
    let participantsBase = existingParticipants;
    if (participantsBase.length === 0) {
      participantsBase = [{
        name:          row.name,
        email:         tutorEmail,
        is_organizer:  true,
        availability:  { calendar_ids: ['primary'] },
        booking:       { calendar_id: 'primary' },
      }];
    }
    // Always stamp the canonical grant email onto existing participants — fixes
    // configs created with a + alias that doesn't match the grant email.
    const updatedParticipants = participantsBase.map(p => ({
      ...p,
      email:                      tutorEmail,
      specific_time_availability: specificTimeAvailability,
    }));

    const updated = await nylasPut<Record<string, unknown>>(
      `/v3/grants/${row.nylas_grant_id}/scheduling/configurations/${configId}`,
      {
        ...cfg,
        requires_session_auth: false,
        participants: updatedParticipants,
        availability: {
          ...existingAvail,
          interval_minutes: cushionMin,
          availability_rules: {
            ...existingRules,
            default_open_hours: openHours,
          },
        },
      },
    );

    if (!updated.ok) {
      return NextResponse.json({ error: updated.error, status: 502 }, { status: 502 });
    }

    // Update stored total availability hours and log activity.
    const allExceptionDates = [
      ...allDayDates,
      ...partialExceptions.map(e => e.date),
    ];
    const workingHoursFmt  = fmtWorkingHours(openHours);
    const breakDurationFmt = fmtBreak(cushionMin);
    const exceptionsFmt    = fmtExceptions(allExceptionDates);

    const availabilityMap = hoursMapToAvailability(hours);

    await Promise.all([
      supabase
        .from('users')
        .update({
          total_availability_hours: totalHours,
          availability: availabilityMap as unknown as Json,
          scheduling_exceptions: exceptions.filter(e => e.date >= new Date().toISOString().slice(0, 10)) as unknown as Json,
        })
        .eq('id', user.id),
      supabase.from('tutor_availability_activity').insert({
        tutor_id:   user.id,
        event_type: 'scheduling_prefs_updated',
        summary:    `Scheduling preferences updated · ${workingHoursFmt}`,
        details: {
          working_hours:  workingHoursFmt,
          break_duration: breakDurationFmt,
          exceptions:     exceptionsFmt,
          total_hours:    totalHours,
        },
      }),
    ]);

    const summary: SchedulerSummary = {
      workingHours:  workingHoursFmt,
      exceptions:    exceptionsFmt,
      breakDuration: breakDurationFmt,
    };

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error('[api/nylas/scheduler PUT]', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
