import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { mintSchedulerEditUrl, createSchedulerConfig } from '@/lib/nylas/scheduler';

export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { data: row, error } = await supabase
    .from('users')
    .select('nylas_scheduler_config_id, name, email, timezone, meeting_link')
    .eq('id', user.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: 'User not found', status: 404 }, { status: 404 });
  }

  // Try the existing config first (fast path).
  if (row.nylas_scheduler_config_id) {
    const mint = await mintSchedulerEditUrl(row.nylas_scheduler_config_id);
    if (mint.url !== null) return NextResponse.json({ url: mint.url });
    // Only fall through to recreate if Nylas confirmed the config is gone (404).
    // Any other error (rate limit, server error) should surface immediately so
    // we don't orphan a config the tutor has already customised.
    if (!mint.configGone) {
      return NextResponse.json({ error: mint.error, status: 502 }, { status: 502 });
    }
  }

  // Create a fresh Scheduler configuration and persist it.
  const created = await createSchedulerConfig({
    tutorName:   row.name,
    tutorEmail:  row.email,
    timezone:    row.timezone ?? 'America/New_York',
    meetingLink: row.meeting_link ?? undefined,
  });

  if (!created) {
    return NextResponse.json({ error: 'Failed to create scheduler configuration', status: 502 }, { status: 502 });
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ nylas_scheduler_config_id: created.configId, booking_page_url: created.bookingUrl })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to persist scheduler configuration', status: 502 }, { status: 502 });
  }

  const mint = await mintSchedulerEditUrl(created.configId);
  if (mint.url === null) {
    return NextResponse.json({ error: mint.error, status: 502 }, { status: 502 });
  }

  return NextResponse.json({ url: mint.url });
}
