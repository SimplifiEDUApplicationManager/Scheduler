import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { isValidRate } from '@/lib/utils/rate';

export async function POST(request: Request) {
  // PENDING tutors are not ACTIVE, so we use requireAuth (session-only check).
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  // Only a PENDING TUTOR may complete onboarding.
  const svc = createServiceClient();
  const { data: userRow } = await svc
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (!userRow || userRow.role !== 'TUTOR' || userRow.status !== 'PENDING') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, timezone, minRate, maxWeeklyHours, minWeeklyHours, meetingLink } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 422 });
  }
  if (!timezone || typeof timezone !== 'string') {
    return NextResponse.json({ error: 'Timezone is required' }, { status: 422 });
  }
  if (!isValidRate(minRate)) {
    return NextResponse.json({ error: 'Rate must be 20, 25, 30, 35, or 40' }, { status: 422 });
  }
  const maxHours = Number(maxWeeklyHours);
  if (!Number.isInteger(maxHours) || maxHours < 6 || maxHours > 40) {
    return NextResponse.json({ error: 'Max weekly hours must be between 6 and 40' }, { status: 422 });
  }
  const minHours = Number(minWeeklyHours ?? 6);
  if (!Number.isInteger(minHours) || minHours < 6 || minHours > maxHours) {
    return NextResponse.json({ error: 'Min weekly hours must be between 6 and max weekly hours' }, { status: 422 });
  }

  const { error } = await svc
    .from('users')
    .update({
      name:             String(name).trim(),
      timezone:         String(timezone),
      min_rate:         minRate as number,
      max_weekly_hours: maxHours,
      min_weekly_hours: minHours,
      meeting_link:     meetingLink ? String(meetingLink).trim() : null,
      status:           'ACTIVE',
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
