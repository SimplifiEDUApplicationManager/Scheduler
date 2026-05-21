import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { nylasGet, nylasPut } from '@/lib/nylas/client';
import { createSchedulerConfig, fmtWorkingHours, fmtBreak, fmtExceptions } from '@/lib/nylas/scheduler';
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

function fromDefaultOpenHours(openHours: OpenHours[]): HoursMap {
  const map: HoursMap = { sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] };
  for (const h of openHours) {
    for (const day of h.days) {
      const key = DAY_NUM_TO_KEY[day];
      if (key) map[key].push({ start: h.start, end: h.end });
    }
  }
  return map;
}

function toDefaultOpenHours(hours: HoursMap, timezone: string, allDayBlockDates: string[]): OpenHours[] {
  // Group days that share the same start/end time into one entry.
  const groups = new Map<string, number[]>();
  for (const [k, windows] of Object.entries(hours) as [DayKey, HoursMap[DayKey]][]) {
    for (const w of windows) {
      const key = `${w.start}|${w.end}`;
      groups.set(key, [...(groups.get(key) ?? []), KEY_TO_DAY_NUM[k]]);
    }
  }
  return [...groups.entries()].map(([key, days]) => {
    const [start, end] = key.split('|') as [string, string];
    return {
      days,
      start,
      end,
      timezone,
      ...(allDayBlockDates.length > 0 ? { exdates: allDayBlockDates } : {}),
    };
  });
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
      .select('nylas_grant_id, nylas_scheduler_config_id')
      .eq('id', user.id)
      .single();

    const defaults: SchedulerPrefs = { hours: { ...EMPTY_HOURS_MAP }, exceptions: [], cushionMin: 0 };

    if (!row?.nylas_grant_id || !row?.nylas_scheduler_config_id) {
      return NextResponse.json(defaults);
    }

    const result = await nylasGet<Record<string, unknown>>(
      `/v3/grants/${row.nylas_grant_id}/scheduling/configurations/${row.nylas_scheduler_config_id}`,
    );
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

    const body = await request.json() as SchedulerPrefs;
    const { hours, exceptions, cushionMin } = body;

    // ── Check total availability hours ──────────────────────────────────────
    const totalHours = computeTotalWeeklyHours(hours);

    if (totalHours < 10) {
      // Block the save — create an approval request instead.
      // The pending prefs are stored in details.prefs so the coordinator can
      // apply them to Nylas when approving.
      const { data: existingReq } = await supabase
        .from('tutor_availability_requests')
        .select('id')
        .eq('tutor_id', user.id)
        .eq('request_type', 'LOW_AVAILABILITY_WINDOWS')
        .eq('status', 'PENDING')
        .maybeSingle();

      if (existingReq) {
        return NextResponse.json(
          { error: 'A pending request for low availability windows already exists. Wait for coordinator review.' },
          { status: 409 },
        );
      }

      const { data: newReq, error: insertErr } = await supabase
        .from('tutor_availability_requests')
        .insert({
          tutor_id:     user.id,
          request_type: 'LOW_AVAILABILITY_WINDOWS',
          reason:       'Submitted via scheduling preferences editor',
          details:      { total_hours: totalHours, prefs: { hours, exceptions, cushionMin } } as unknown as Json,
          status:       'PENDING',
        })
        .select('id')
        .single();

      if (insertErr) {
        return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 });
      }

      return NextResponse.json({
        ok:           false,
        needs_approval: true,
        request_id:   newReq.id,
        total_hours:  totalHours,
      });
    }

    const { data: row } = await supabase
      .from('users')
      .select('name, email, timezone, meeting_link, nylas_grant_id, nylas_scheduler_config_id')
      .eq('id', user.id)
      .single();

    if (!row?.nylas_grant_id) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    const timezone = (row.timezone as string | null) ?? 'America/New_York';
    let configId = row.nylas_scheduler_config_id as string | null;

    // Create config if it doesn't exist yet.
    if (!configId) {
      const created = await createSchedulerConfig({
        tutorName:   row.name as string,
        tutorEmail:  row.email as string,
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
    const current = await nylasGet<Record<string, unknown>>(
      `/v3/grants/${row.nylas_grant_id}/scheduling/configurations/${configId}`,
    );
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
    const existingParticipants = (cfg.participants ?? []) as Record<string, unknown>[];
    const updatedParticipants = existingParticipants.map(p => ({
      ...p,
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

    await Promise.all([
      supabase
        .from('users')
        .update({ total_availability_hours: totalHours })
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
