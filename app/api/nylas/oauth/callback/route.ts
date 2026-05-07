import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { decodeOAuthState, exchangeCodeForGrant } from '@/lib/nylas';

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
    console.error('[nylas/oauth/callback] Failed to save grant_id:', updateError);
    return errRedirect('db_update_failed');
  }

  const role = updatedUser?.role as string | undefined;
  const home = role === 'TUTOR' ? '/tutor/settings' : '/dashboard';
  return NextResponse.redirect(`${origin}${home}?nylas_success=calendar_connected`);
}
