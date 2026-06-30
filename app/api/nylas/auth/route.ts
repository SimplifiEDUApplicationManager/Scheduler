import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { nylasCallbackUri, nylasApiUri, encodeOAuthState } from '@/lib/nylas';

export async function GET(request: NextRequest) {
  // userId comes from the authenticated session — never from the query string.
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const emailHint = searchParams.get('email');

  // Fetch email for login_hint if not provided by the caller.
  let loginHint = emailHint;
  if (!loginHint) {
    const { data } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single();
    loginHint = data?.email ?? null;
  }

  // Optional scheduling prefs forwarded from the onboarding wizard.
  const openHoursRaw = searchParams.get('open_hours');
  const cushionRaw   = searchParams.get('cushion');
  let openHours: import('@/lib/nylas').OAuthOpenHours[] | undefined;
  let cushionMinutes: number | undefined;
  try {
    if (openHoursRaw) openHours = JSON.parse(openHoursRaw) as import('@/lib/nylas').OAuthOpenHours[];
  } catch { /* ignore malformed */ }
  if (cushionRaw) {
    const n = parseInt(cushionRaw, 10);
    if (!isNaN(n) && n >= 0) cushionMinutes = n;
  }

  const params = new URLSearchParams({
    client_id:     process.env.NYLAS_CLIENT_ID!,
    redirect_uri:  nylasCallbackUri(),
    response_type: 'code',
    access_type:   'offline',
    scope:         'https://www.googleapis.com/auth/calendar',
    state:         encodeOAuthState(user.id, openHours, cushionMinutes),
  });

  if (loginHint) params.set('login_hint', loginHint);

  return NextResponse.redirect(`${nylasApiUri()}/v3/connect/auth?${params}`);
}
