import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(`${origin}/dashboard?nylas_error=${encodeURIComponent(errorParam)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard?nylas_error=missing_params`);
  }

  // Decode state to get userId
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    userId = decoded.userId;
    if (!userId) throw new Error('no userId');
  } catch {
    return NextResponse.redirect(`${origin}/dashboard?nylas_error=invalid_state`);
  }

  // Exchange code for grant_id
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://simplifi-scheduler.vercel.app'}/api/nylas/callback`;

  const tokenRes = await fetch(
    `${process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com'}/v3/connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.NYLAS_CLIENT_ID,
        client_secret: process.env.NYLAS_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    }
  );

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error('Nylas token exchange failed:', text);
    return NextResponse.redirect(`${origin}/dashboard?nylas_error=token_exchange_failed`);
  }

  const tokenData = await tokenRes.json();
  const grantId: string | undefined = tokenData.grant_id ?? tokenData.data?.grant_id;

  if (!grantId) {
    console.error('No grant_id in Nylas token response:', tokenData);
    return NextResponse.redirect(`${origin}/dashboard?nylas_error=no_grant_id`);
  }

  // Store grant_id on the user row and fetch role for the redirect.
  const supabase = createServiceClient();
  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ nylas_grant_id: grantId, status: 'ACTIVE' })
    .eq('id', userId)
    .select('role')
    .single();

  if (updateError) {
    console.error('Failed to save grant_id:', updateError);
    return NextResponse.redirect(`${origin}/dashboard?nylas_error=db_update_failed`);
  }

  const home = updatedUser?.role === 'TUTOR' ? '/tutor/settings' : '/dashboard';
  return NextResponse.redirect(`${origin}${home}?nylas_success=calendar_connected`);
}
