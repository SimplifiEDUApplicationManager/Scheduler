import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createHmac } from 'crypto';

const NYLAS_AUTH_URL = 'https://api.us.nylas.com/v3/connect/auth';

// Maps our provider keys to Nylas provider identifiers
const PROVIDER_MAP: Record<string, string> = {
  google:   'google',
  outlook:  'microsoft',
  icloud:   'apple',
};

/**
 * Signs a payload with HMAC-SHA256 using NYLAS_STATE_SECRET.
 * Returns "<base64url-payload>.<base64url-sig>" so the callback can verify
 * the payload was produced by this server before trusting the userId inside it.
 */
function signState(payload: object): string {
  const secret = process.env.NYLAS_STATE_SECRET;
  if (!secret) throw new Error('NYLAS_STATE_SECRET is not set');
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/**
 * GET /api/nylas/connect?provider=google|outlook|icloud
 *
 * Builds the Nylas hosted-auth URL and redirects the browser to it.
 * After the user grants permission, Nylas redirects to /api/nylas/callback.
 *
 * The `state` param is HMAC-signed so the callback can verify it was produced
 * by this server before using the userId inside it to write to the DB.
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

  const state = signState({ userId: user.id });

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
