import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { nylasPut, nylasGet } from '@/lib/nylas/client';
import { fmtWorkingHours, fmtBreak, fmtExceptions } from '@/lib/nylas/scheduler';
import type { OpenHours } from '@/lib/nylas/scheduler';
import type { HoursMap, SchedulerException, DayKey } from '@/lib/types/scheduler';

const KEY_TO_DAY_NUM: Record<DayKey, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

type SpecificTimeEntry = { date: string; start: string; end: string };

function toDefaultOpenHours(hours: HoursMap, timezone: string, allDayBlockDates: string[]): OpenHours[] {
  const groups = new Map<string, number[]>();
  for (const [k, windows] of Object.entries(hours) as [DayKey, HoursMap[DayKey]][]) {
    for (const w of windows) {
      const key = `${w.start}|${w.end}`;
      groups.set(key, [...(groups.get(key) ?? []), KEY_TO_DAY_NUM[k]]);
    }
  }
  return [...groups.entries()].map(([key, days]) => {
    const [start, end] = key.split('|') as [string, string];
    return { days, start, end, timezone, ...(allDayBlockDates.length > 0 ? { exdates: allDayBlockDates } : {}) };
  });
}

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

/**
 * POST /api/tutor/availability-request/[id]/approve
 * Coordinator approves a pending availability request.
 *
 * Effects by request_type:
 *   PAUSE                    → sets users.is_paused = true; logs 'paused' activity
 *   LOW_MAX_HOURS            → sets users.max_weekly_hours = details.requested_hours
 *   LOW_AVAILABILITY_WINDOWS → applies pending prefs to Nylas; updates total_availability_hours
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { id } = await params;

  const { data: req, error: fetchErr } = await supabase
    .from('tutor_availability_requests')
    .select('id, tutor_id, request_type, reason, details, status')
    .eq('id', id)
    .single();

  if (fetchErr || !req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (req.status !== 'PENDING') {
    return NextResponse.json({ error: `Request is already ${req.status}` }, { status: 409 });
  }

  // ── Apply the change ───────────────────────────────────────────────────────

  if (req.request_type === 'PAUSE') {
    const { error: updateErr } = await supabase
      .from('users')
      .update({ is_paused: true })
      .eq('id', req.tutor_id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Log activity
    await supabase.from('tutor_availability_activity').insert({
      tutor_id:   req.tutor_id,
      event_type: 'paused',
      summary:    'Availability paused',
      details:    { reason: req.reason },
    });
  }

  if (req.request_type === 'LOW_MAX_HOURS') {
    const details = req.details as Record<string, unknown> | null;
    const requestedHours = details?.requested_hours as number | undefined;
    if (!requestedHours) return NextResponse.json({ error: 'Missing requested_hours in details' }, { status: 500 });

    const { error: updateErr } = await supabase
      .from('users')
      .update({ max_weekly_hours: requestedHours })
      .eq('id', req.tutor_id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    await supabase.from('tutor_availability_activity').insert({
      tutor_id:   req.tutor_id,
      event_type: 'hours_changed',
      summary:    `Max weekly hours changed to ${requestedHours}`,
      details:    { new_max_hours: requestedHours },
    });
  }

  if (req.request_type === 'LOW_AVAILABILITY_WINDOWS') {
    const details = req.details as Record<string, unknown> | null;
    const prefs   = details?.prefs as { hours: HoursMap; exceptions: SchedulerException[]; cushionMin: number } | undefined;
    if (!prefs) return NextResponse.json({ error: 'Missing prefs in details' }, { status: 500 });

    // Fetch tutor's Nylas config
    const { data: tutorRow } = await supabase
      .from('users')
      .select('nylas_grant_id, nylas_scheduler_config_id, timezone')
      .eq('id', req.tutor_id)
      .single();

    if (!tutorRow?.nylas_grant_id || !tutorRow?.nylas_scheduler_config_id) {
      return NextResponse.json({ error: 'Tutor has no Nylas config' }, { status: 400 });
    }

    const timezone = (tutorRow.timezone as string | null) ?? 'America/New_York';
    const { hours, exceptions, cushionMin } = prefs;

    const allDayDates  = exceptions.filter(e => e.windows.length === 0).map(e => e.date);
    const partialExs   = exceptions.filter(e => e.windows.length > 0);
    const specificTime: SpecificTimeEntry[] = partialExs.flatMap(e =>
      e.windows.map(w => ({ date: e.date, start: w.start, end: w.end })),
    );
    const openHours = toDefaultOpenHours(hours, timezone, allDayDates);

    const current = await nylasGet<Record<string, unknown>>(
      `/v3/grants/${tutorRow.nylas_grant_id}/scheduling/configurations/${tutorRow.nylas_scheduler_config_id}`,
    );
    if (!current.ok) return NextResponse.json({ error: 'Failed to fetch Nylas config' }, { status: 502 });

    const { id: _id, created_at: _ca, updated_at: _ua, ...cfg } = current.data;
    const existingAvail = (cfg.availability ?? {}) as Record<string, unknown>;
    const existingRules = (existingAvail.availability_rules ?? {}) as Record<string, unknown>;
    const existingParticipants = (cfg.participants ?? []) as Record<string, unknown>[];
    const updatedParticipants = existingParticipants.map(p => ({
      ...p,
      specific_time_availability: specificTime,
    }));

    const updated = await nylasPut<Record<string, unknown>>(
      `/v3/grants/${tutorRow.nylas_grant_id}/scheduling/configurations/${tutorRow.nylas_scheduler_config_id}`,
      {
        ...cfg,
        requires_session_auth: false,
        participants: updatedParticipants,
        availability: {
          ...existingAvail,
          interval_minutes: cushionMin,
          availability_rules: { ...existingRules, default_open_hours: openHours },
        },
      },
    );
    if (!updated.ok) return NextResponse.json({ error: 'Failed to update Nylas config' }, { status: 502 });

    const totalHours = computeTotalWeeklyHours(hours);
    await supabase
      .from('users')
      .update({ total_availability_hours: totalHours })
      .eq('id', req.tutor_id);

    const summary = fmtWorkingHours(openHours);
    await supabase.from('tutor_availability_activity').insert({
      tutor_id:   req.tutor_id,
      event_type: 'scheduling_prefs_updated',
      summary:    `Scheduling preferences updated · ${summary}`,
      details: {
        working_hours:  summary,
        break_duration: fmtBreak(cushionMin),
        exceptions:     fmtExceptions([...allDayDates, ...partialExs.map(e => e.date)]),
        total_hours:    totalHours,
      },
    });
  }

  // ── Mark approved ──────────────────────────────────────────────────────────

  const { data: updated, error: approveErr } = await supabase
    .from('tutor_availability_requests')
    .update({ status: 'APPROVED', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status, reviewed_at')
    .single();

  if (approveErr) return NextResponse.json({ error: approveErr.message }, { status: 500 });

  return NextResponse.json(updated);
}
