import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { mintSchedulerEditUrl } from '@/lib/nylas/scheduler';

export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { data: row, error } = await supabase
    .from('users')
    .select('nylas_scheduler_config_id')
    .eq('id', user.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: 'User not found', status: 404 }, { status: 404 });
  }

  if (!row.nylas_scheduler_config_id) {
    return NextResponse.json({ error: 'No Nylas Scheduler config linked to this account', status: 422 }, { status: 422 });
  }

  const url = await mintSchedulerEditUrl(row.nylas_scheduler_config_id);
  if (!url) {
    return NextResponse.json({ error: 'Failed to generate scheduler edit link', status: 502 }, { status: 502 });
  }

  return NextResponse.json({ url });
}
