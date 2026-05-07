import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

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

  const clientId = process.env.NYLAS_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://simplifi-scheduler.vercel.app'}/api/nylas/callback`;

  // Encode userId in state so callback knows which user to update.
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    state,
  });

  if (loginHint) params.set('login_hint', loginHint);

  const authUrl = `${process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com'}/v3/connect/auth?${params}`;

  return NextResponse.redirect(authUrl);
}
