import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

const NYLAS_API = 'https://api.us.nylas.com';

/**
 * GET /api/nylas/callback?code=...&state=...
 *
 * Handles the redirect from Nylas after the tutor grants calendar access.
 * Steps:
 *   1. Exchange the auth code for a grant_id via Nylas token endpoint
 *   2. Create a default Nylas Scheduler configuration for the tutor
 *   3. Write nylas_grant_id, nylas_scheduler_config_id, booking_page_url to public.users
 *   4. Redirect to /onboarding?step=4
 *
 * Uses the service-role client to bypass RLS — we trust the signed state param
 * to identify which user to update.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/onboarding?error=oauth_failed', request.url));
  }

  // Decode user ID from state
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { userId: string };
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect(new URL('/onboarding?error=invalid_state', request.url));
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/nylas/callback`;

  // ── 1. Exchange code for grant_id ──────────────────────────────────────────
  const tokenRes = await fetch(`${NYLAS_API}/v3/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.NYLAS_CLIENT_ID,
      client_secret: process.env.NYLAS_CLIENT_SECRET,
      code,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('[nylas/callback] token exchange failed:', err);
    return NextResponse.redirect(new URL('/onboarding?error=token_exchange', request.url));
  }

  const tokenData = await tokenRes.json() as { grant_id: string; email: string };
  const grantId = tokenData.grant_id;

  // ── 2. Create default Nylas Scheduler config ───────────────────────────────
  // Fetch user name + email from DB so we can populate the participant record.
  const supabase = createServiceClient();
  const { data: userRow } = await supabase
    .from('users')
    .select('name, email, timezone')
    .eq('id', userId)
    .single();

  const tutorName  = userRow?.name  ?? tokenData.email;
  const tutorEmail = userRow?.email ?? tokenData.email;

  // Default availability: Mon–Fri 9am–5pm in the tutor's timezone (slot size 30 min)
  const defaultOpenHours = [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', exdates: [] }];

  const configRes = await fetch(`${NYLAS_API}/v3/scheduling/configurations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NYLAS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requires_session_auth: false,
      participants: [
        {
          name:           tutorName,
          email:          tutorEmail,
          is_organizer:   true,
          availability: {
            calendar_ids: ['primary'],
            open_hours:   defaultOpenHours,
          },
          booking: { calendar_id: 'primary' },
        },
      ],
      availability: {
        duration_minutes:  60,
        interval_minutes:  15,
      },
      booking: {
        type:                'booking',
        confirmation_method: 'automatic',
      },
    }),
  });

  let configId: string | null = null;
  let bookingUrl: string | null = null;

  if (configRes.ok) {
    const configData = await configRes.json() as {
      data: { configuration_id: string; scheduler?: { slug?: string; public_url?: string } };
    };
    configId   = configData.data.configuration_id;
    bookingUrl = configData.data.scheduler?.public_url
      ?? (configData.data.scheduler?.slug
        ? `https://book.nylas.com/${configData.data.scheduler.slug}`
        : null);
  } else {
    // Non-fatal — tutor can still complete onboarding; scheduler config can be retried.
    console.error('[nylas/callback] scheduler config creation failed:', await configRes.text());
  }

  // ── 3. Write to public.users ───────────────────────────────────────────────
  await supabase
    .from('users')
    .update({
      nylas_grant_id:             grantId,
      nylas_scheduler_config_id:  configId,
      ...(bookingUrl ? { booking_page_url: bookingUrl } : {}),
    })
    .eq('id', userId);

  // ── 4. Back to onboarding at step 4 ───────────────────────────────────────
  redirect('/onboarding?step=4');
}
