import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { isValidRate } from '@/lib/utils/rate';

export async function PATCH(request: Request) {
  const auth = await requireActiveRole(['TUTOR', 'COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', status: 400 }, { status: 400 });
  }

  // Only allow tutors (and super admins) to update their own profile via this route.
  // Allowed fields:
  const ALLOWED: Record<string, string> = {
    name:            'name',
    timezone:        'timezone',
    maxWeeklyHours:  'max_weekly_hours',
    minWeeklyHours:  'min_weekly_hours',
    minRate:         'min_rate',
    meetingLink:     'meeting_link',
    isPaused:        'is_paused',
  };

  const update: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(ALLOWED)) {
    if (key in body) update[col] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided', status: 400 }, { status: 400 });
  }

  // is_paused: tutors may only set this to false (resume). Pausing requires an availability request.
  if ('is_paused' in update) {
    if (update['is_paused'] !== false) {
      return NextResponse.json({ error: 'Submit a pause request to pause availability', status: 422 }, { status: 422 });
    }
  }

  // Validate min_rate
  if ('min_rate' in update) {
    if (!isValidRate(update['min_rate'])) {
      return NextResponse.json({ error: 'min_rate must be 20, 25, 30, 35, or 40', status: 422 }, { status: 422 });
    }
  }

  // Validate max hours
  if ('max_weekly_hours' in update) {
    const v = Number(update['max_weekly_hours']);
    if (!Number.isInteger(v) || v < 1 || v > 40) {
      return NextResponse.json({ error: 'max_weekly_hours must be an integer between 1 and 40', status: 422 }, { status: 422 });
    }
    // Values ≤ 5 must go through the approval flow — block direct save.
    if (v <= 5) {
      return NextResponse.json({ error: 'Hours of 5 or below require coordinator approval. Submit an availability request instead.', status: 422 }, { status: 422 });
    }
    // Max hours cannot exceed total availability hours (if the tutor has set scheduling prefs).
    const { data: tutorRow } = await supabase
      .from('users')
      .select('total_availability_hours')
      .eq('id', user.id)
      .single();
    const totalAvail = Number(tutorRow?.total_availability_hours ?? 0);
    if (totalAvail > 0 && v > totalAvail) {
      return NextResponse.json(
        { error: `Max hours (${v}) cannot exceed your total available windows (${totalAvail} hrs/week)`, status: 422 },
        { status: 422 },
      );
    }
  }

  const { error: updateError } = await supabase
    .from('users')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(update as any)
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message, status: 500 }, { status: 500 });
  }

  // ── Activity logging ───────────────────────────────────────────────────────

  if ('timezone' in update) {
    await supabase.from('tutor_availability_activity').insert({
      tutor_id:   user.id,
      event_type: 'timezone_changed',
      summary:    `Timezone changed to ${String(update['timezone'])}`,
      details:    { new_timezone: update['timezone'] },
    });
  }

  if ('max_weekly_hours' in update || 'min_weekly_hours' in update) {
    await supabase.from('tutor_availability_activity').insert({
      tutor_id:   user.id,
      event_type: 'hours_changed',
      summary:    'Weekly hour limits updated',
      details: {
        ...('max_weekly_hours' in update ? { new_max_hours: update['max_weekly_hours'] } : {}),
        ...('min_weekly_hours' in update ? { new_min_hours: update['min_weekly_hours'] } : {}),
      },
    });
  }

  if ('is_paused' in update && update['is_paused'] === false) {
    await supabase.from('tutor_availability_activity').insert({
      tutor_id:   user.id,
      event_type: 'resumed',
      summary:    'Availability resumed',
    });
  }

  return NextResponse.json({ ok: true });
}
