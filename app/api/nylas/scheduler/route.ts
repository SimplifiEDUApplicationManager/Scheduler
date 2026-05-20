import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { nylasGet, nylasPut } from '@/lib/nylas/client';
import { createSchedulerConfig, fmtWorkingHours, fmtBreak, fmtExceptions } from '@/lib/nylas/scheduler';
import type { SchedulerSummary } from '@/lib/nylas/scheduler';
import type { DayKey, HoursMap, SchedulerException, SchedulerPrefs } from '@/lib/types/scheduler';
import { EMPTY_HOURS_MAP } from '@/lib/types/scheduler';

// ── Nylas ↔ SchedulerPrefs conversions ──────────────────────────────────────

type NylasWindow = { days: string[]; start_time: string; end_time: string };
type NylasException = { date: string; hours: { start_time: string; end_time: string }[] };

const DAY_TO_KEY: Record<string, DayKey> = {
  sunday: 'sun', monday: 'mon', tuesday: 'tue', wednesday: 'wed',
  thursday: 'thu', friday: 'fri', saturday: 'sat',
};
const KEY_TO_DAY: Record<DayKey, string> = {
  sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday',
  thu: 'thursday', fri: 'friday', sat: 'saturday',
};

function fromNylasWindows(windows: NylasWindow[]): HoursMap {
  const map: HoursMap = { ...EMPTY_HOURS_MAP, sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] };
  for (const w of windows) {
    for (const day of w.days) {
      const key = DAY_TO_KEY[day];
      if (key) map[key].push({ start: w.start_time, end: w.end_time });
    }
  }
  return map;
}

function toNylasWindows(hours: HoursMap): NylasWindow[] {
  const groups = new Map<string, string[]>();
  for (const [k, windows] of Object.entries(hours) as [DayKey, HoursMap[DayKey]][]) {
    for (const w of windows) {
      const key = `${w.start}|${w.end}`;
      groups.set(key, [...(groups.get(key) ?? []), KEY_TO_DAY[k]]);
    }
  }
  return [...groups.entries()].map(([key, days]) => {
    const [start_time, end_time] = key.split('|') as [string, string];
    return { days, start_time, end_time };
  });
}

function fromNylasExceptions(items: NylasException[]): SchedulerException[] {
  return items.map(d => ({
    date: d.date,
    windows: d.hours.map(h => ({ start: h.start_time, end: h.end_time })),
  }));
}

function toNylasExceptions(exceptions: SchedulerException[]): NylasException[] {
  return exceptions.map(e => ({
    date: e.date,
    hours: e.windows.map(w => ({ start_time: w.start, end_time: w.end })),
  }));
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

    return NextResponse.json({
      hours:      fromNylasWindows((rules?.availability_windows ?? []) as NylasWindow[]),
      exceptions: fromNylasExceptions((rules?.date_specific_hours ?? []) as NylasException[]),
      cushionMin: (avail?.interval_minutes as number | undefined) ?? 0,
    });
  } catch (err) {
    console.error('[api/nylas/scheduler GET]', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}

// ── PUT — save scheduler preferences ────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const body = await request.json() as SchedulerPrefs;
    const { hours, exceptions, cushionMin } = body;

    const { data: row } = await supabase
      .from('users')
      .select('name, email, timezone, meeting_link, nylas_grant_id, nylas_scheduler_config_id')
      .eq('id', user.id)
      .single();

    if (!row?.nylas_grant_id) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    let configId = row.nylas_scheduler_config_id as string | null;

    // Create config if it doesn't exist yet.
    if (!configId) {
      const created = await createSchedulerConfig({
        tutorName:   row.name as string,
        tutorEmail:  row.email as string,
        timezone:    (row.timezone as string | null) ?? 'America/New_York',
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

    const updated = await nylasPut<Record<string, unknown>>(
      `/v3/grants/${row.nylas_grant_id}/scheduling/configurations/${configId}`,
      {
        ...cfg,
        availability: {
          ...existingAvail,
          interval_minutes: cushionMin,
          availability_rules: {
            ...existingRules,
            availability_windows: toNylasWindows(hours),
            date_specific_hours:  toNylasExceptions(exceptions),
          },
        },
      },
    );

    if (!updated.ok) {
      return NextResponse.json({ error: updated.error, status: 502 }, { status: 502 });
    }

    // Return formatted summary so the settings card updates without a page reload.
    const nylasWindows = toNylasWindows(hours);
    const nylasExceptions = toNylasExceptions(exceptions);
    const summary: SchedulerSummary = {
      workingHours:  fmtWorkingHours(nylasWindows as Parameters<typeof fmtWorkingHours>[0]),
      exceptions:    fmtExceptions(nylasExceptions as Parameters<typeof fmtExceptions>[0]),
      breakDuration: fmtBreak(cushionMin),
    };

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error('[api/nylas/scheduler PUT]', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
