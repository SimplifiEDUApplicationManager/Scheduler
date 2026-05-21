import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { decodeOAuthState, exchangeCodeForGrant } from '@/lib/nylas';
import { createSchedulerConfig } from '@/lib/nylas/scheduler';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get('code');
  const state      = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // Redirect to role-appropriate page on failure.
  // We don't know the role until after we decode state + query the DB, so we
  // fall back to /dashboard; the tutor-specific error page is set after lookup.
  const errRedirect = (reason: string, role?: string) => {
    const base = role === 'TUTOR' ? '/tutor/settings' : '/dashboard';
    return NextResponse.redirect(`${origin}${base}?nylas_error=${encodeURIComponent(reason)}`);
  };

  if (errorParam)      return errRedirect(errorParam);
  if (!code || !state) return errRedirect('missing_params');

  const decoded = decodeOAuthState(state);
  if (!decoded.ok) return errRedirect('invalid_state');

  // Fetch role + fields needed to create a scheduler config for tutors.
  const supabase = createServiceClient();
  const { data: userRow } = await supabase
    .from('users')
    .select('role, name, email, timezone, meeting_link, nylas_scheduler_config_id')
    .eq('id', decoded.userId)
    .single();
  const role = userRow?.role as string | undefined;

  const exchange = await exchangeCodeForGrant(code);
  if (!exchange.ok) return errRedirect(exchange.error, role);

  const { error: updateError } = await supabase
    .from('users')
    .update({ nylas_grant_id: exchange.grantId, status: 'ACTIVE' })
    .eq('id', decoded.userId);

  if (updateError) {
    console.error('[nylas/oauth/callback] Failed to save grant_id:', updateError);
    return errRedirect('db_update_failed', role);
  }

  // Auto-create a Nylas Scheduler config the first time a tutor connects.
  // This gives them a booking page URL immediately without any extra steps.
  if (role === 'TUTOR' && !userRow?.nylas_scheduler_config_id && userRow?.name && userRow?.email) {
    const created = await createSchedulerConfig({
      tutorName:   userRow.name,
      tutorEmail:  userRow.email,
      timezone:    (userRow.timezone as string | null) ?? 'America/New_York',
      grantId:     exchange.grantId,
      meetingLink: (userRow.meeting_link as string | null) ?? undefined,
    });
    if (created.configId !== null) {
      await supabase
        .from('users')
        .update({ nylas_scheduler_config_id: created.configId, booking_page_url: created.bookingUrl })
        .eq('id', decoded.userId);
    } else {
      console.error('[nylas/oauth/callback] Failed to create scheduler config:', created.error);
    }
  }

  const home = role === 'TUTOR' ? '/tutor/settings' : '/dashboard';
  return NextResponse.redirect(`${origin}${home}?nylas_success=calendar_connected`);
}
