import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

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
    meetingLink:     'meeting_link',
  };

  const update: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(ALLOWED)) {
    if (key in body) update[col] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided', status: 400 }, { status: 400 });
  }

  // Validate hours
  if ('max_weekly_hours' in update) {
    const v = Number(update['max_weekly_hours']);
    if (!Number.isInteger(v) || v < 6 || v > 40) {
      return NextResponse.json({ error: 'max_weekly_hours must be an integer between 6 and 40', status: 422 }, { status: 422 });
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

  return NextResponse.json({ ok: true });
}
