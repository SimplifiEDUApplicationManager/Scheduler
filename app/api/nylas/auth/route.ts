import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const email = searchParams.get('email');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const clientId = process.env.NYLAS_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://simplifi-scheduler.vercel.app'}/api/nylas/callback`;

  // Encode userId in state so callback knows which user to update
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    state,
  });

  // Pre-fill the Google account if email is provided
  const loginHint = email ?? user.email;
  if (loginHint) params.set('login_hint', loginHint);

  const authUrl = `${process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com'}/v3/connect/auth?${params}`;

  return NextResponse.redirect(authUrl);
}
