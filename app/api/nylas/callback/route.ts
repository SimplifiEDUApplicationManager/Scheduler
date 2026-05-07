import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { decodeOAuthState, exchangeCodeForGrant } from '@/lib/nylas';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get('code');
  const state      = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const errRedirect = (reason: string) =>
    NextResponse.redirect(`${origin}/dashboard?nylas_error=${encodeURIComponent(reason)}`);

  if (errorParam)      return errRedirect(errorParam);
  if (!code || !state) return errRedirect('missing_params');

  const decoded = decodeOAuthState(state);
  if (!decoded.ok) return errRedirect('invalid_state');

  const exchange = await exchangeCodeForGrant(code);
  if (!exchange.ok) return errRedirect(exchange.error);

  const supabase = createServiceClient();
  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ nylas_grant_id: exchange.grantId, status: 'ACTIVE' })
    .eq('id', decoded.userId)
    .select('role')
    .single();

  if (updateError) {
    console.error('Failed to save grant_id:', updateError);
    return errRedirect('db_update_failed');
  }

  const home = updatedUser?.role === 'TUTOR' ? '/tutor/settings' : '/dashboard';
  return NextResponse.redirect(`${origin}${home}?nylas_success=calendar_connected`);
}
