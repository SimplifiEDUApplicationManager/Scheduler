import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { mintSchedulerEditUrl, createSchedulerConfig, enableSchedulerSessionAuth } from '@/lib/nylas/scheduler';

export async function POST() {
  try {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { data: row, error } = await supabase
    .from('users')
    .select('nylas_scheduler_config_id, nylas_grant_id, name, email, timezone, meeting_link')
    .eq('id', user.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: 'User not found', status: 404 }, { status: 404 });
  }

  // Try the existing config first (fast path).
  if (row.nylas_scheduler_config_id) {
    const mint = await mintSchedulerEditUrl(row.nylas_scheduler_config_id);
    if (mint.url !== null) return NextResponse.json({ url: mint.url });

    if (mint.sessionAuthDisabled) {
      // Config exists but was created without requires_session_auth: true.
      // Patch it to enable session auth, then retry once.
      const patched = await enableSchedulerSessionAuth(row.nylas_scheduler_config_id, row.nylas_grant_id);
      if (patched) {
        const retry = await mintSchedulerEditUrl(row.nylas_scheduler_config_id);
        if (retry.url !== null) return NextResponse.json({ url: retry.url });
        // Only fall through to recreate if Nylas confirmed the config is gone.
        if (!retry.configGone) {
          return NextResponse.json({ error: `[post-patch mint] ${retry.error}`, status: 502 }, { status: 502 });
        }
      }
      // Patch failed or config confirmed gone after retry — fall through to recreate.
    } else if (!mint.configGone) {
      // Any other error (rate limit, server error) — surface it immediately so
      // we don't orphan a config the tutor has already customised.
      return NextResponse.json({ error: mint.error, status: 502 }, { status: 502 });
    }
  }

  // Create a fresh Scheduler configuration and persist it.
  if (!row.nylas_grant_id) {
    return NextResponse.json({ error: 'Calendar not connected — connect your calendar before editing scheduling preferences.', status: 400 }, { status: 400 });
  }
  const created = await createSchedulerConfig({
    tutorName:   row.name,
    tutorEmail:  row.email,
    timezone:    row.timezone ?? 'America/New_York',
    grantId:     row.nylas_grant_id,
    meetingLink: row.meeting_link ?? undefined,
  });

  if (created.configId === null) {
    return NextResponse.json({ error: `[create config] ${created.error}`, status: 502 }, { status: 502 });
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ nylas_scheduler_config_id: created.configId!, booking_page_url: created.bookingUrl })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to persist scheduler configuration', status: 502 }, { status: 502 });
  }

  const mint = await mintSchedulerEditUrl(created.configId!);
  if (mint.url === null) {
    return NextResponse.json({ error: mint.error, status: 502 }, { status: 502 });
  }

  return NextResponse.json({ url: mint.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scheduler-edit-link] Unhandled error:', msg);
    return NextResponse.json({ error: `[unhandled] ${msg}` }, { status: 502 });
  }
}
