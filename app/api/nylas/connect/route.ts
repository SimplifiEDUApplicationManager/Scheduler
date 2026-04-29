import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const NYLAS_AUTH_URL = 'https://api.us.nylas.com/v3/connect/auth';

// Maps our provider keys to Nylas provider identifiers
const PROVIDER_MAP: Record<string, string> = {
  google:   'google',
  outlook:  'microsoft',
  icloud:   'apple',
};

/**
 * GET /api/nylas/connect?provider=google|outlook|icloud
 *
 * Builds the Nylas hosted-auth URL and redirects the browser to it.
 * After the user grants permission, Nylas redirects to /api/nylas/callback.
 *
 * The `state` param encodes the user ID so the callback can write to the
 * correct row without an extra session lookup.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') ?? 'google';

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect('/login');
  }

  const nylasProvider = PROVIDER_MAP[provider] ?? 'google';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/nylas/callback`;

  // Encode user ID in state so the callback knows which row to update.
  // A production implementation should sign this (e.g. HMAC) to prevent forgery.
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64url');

  const params = new URLSearchParams({
    client_id:    process.env.NYLAS_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    provider:     nylasProvider,
    login_hint:   user.email ?? '',
    scope:        'openid,email,calendar',
    state,
  });

  redirect(`${NYLAS_AUTH_URL}?${params.toString()}`);
}
