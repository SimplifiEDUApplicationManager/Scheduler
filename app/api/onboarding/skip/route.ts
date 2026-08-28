import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/onboarding/skip
 * Skips the onboarding tutorial entirely, setting the tutor to ACTIVE
 * with sensible defaults. They can configure everything later in Settings.
 */
export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const svc = createServiceClient();
  const { data: userRow } = await svc
    .from('users')
    .select('role, status, name')
    .eq('id', user.id)
    .single();

  if (!userRow || userRow.role !== 'TUTOR' || userRow.status !== 'PENDING') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await svc
    .from('users')
    .update({
      status:           'ACTIVE',
      timezone:         'America/New_York',
      min_rate:         20,
      max_weekly_hours: 20,
      min_weekly_hours: 6,
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
