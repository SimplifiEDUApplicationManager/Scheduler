import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const NYLAS_API = 'https://api.us.nylas.com';

/**
 * Verifies an HMAC-signed state token produced by /api/nylas/connect.
 * Format: "<base64url-payload>.<base64url-sig>"
 * Throws if the signature is invalid or the secret is missing.
 */
function verifyState(state: string): { userId: string } {
  const secret = process.env.NYLAS_STATE_SECRET;
  if (!secret) throw new Error('NYLAS_STATE_SECRET is not set');

  const dot = state.lastIndexOf('.');
  if (dot === -1) throw new Error('Malformed state');

  const data = state.slice(0, dot);
  const sig  = state.slice(dot + 1);

  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  // Use timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid state signature');
  }

  return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as { userId: string };
}

/**
 * GET /api/nylas/callback?code=...&state=...
 *
 * Handles the redirect from Nylas after the tutor grants calendar access.
 * Steps:
 *   1. Verify the HMAC-signed state param, extract userId
 *   2. Exchange the auth code for a grant_id via Nylas token endpoint
 *   3. Create a default Nylas Scheduler configuration for the tutor
 *   4. Write nylas_grant_id, nylas_scheduler_config_id, booking_page_url to public.users
 *   5. Redirect to /onboarding?step=4
 *
 * Uses the service-role client to bypass RLS. The signed state param is the
 * trust anchor — we verify it before using the userId inside.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/onboarding?error=oauth_failed', request.url));
  }

  // Verify HMAC signature and extract userId
  let userId: string;
  try {
    ({ userId } = verifyState(state));
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
  const { error: updateError } = await supabase
    .from('users')
    .update({
      nylas_grant_id:             grantId,
      nylas_scheduler_config_id:  configId,
      ...(bookingUrl ? { booking_page_url: bookingUrl } : {}),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[nylas/callback] failed to write grant to users table:', updateError.message);
    return NextResponse.redirect(new URL('/onboarding?error=db_write_failed', request.url));
  }

  // ── 4. Back to onboarding at step 4 ───────────────────────────────────────
  // Use NextResponse.redirect (not next/navigation redirect) so the URL is
  // anchored to the incoming request hostname, which is correct in proxied deployments.
  return NextResponse.redirect(new URL('/onboarding?step=4', request.url));
}
