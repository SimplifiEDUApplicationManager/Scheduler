import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendInviteEmail } from '@/lib/resend/emails';

const siteUrl = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

export async function POST(request: Request) {
  const auth = await requireActiveRole(['SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { email, name, region } = body as {
    email: string;
    name?: string;
    region: string;
    message?: string;
  };

  if (!email || !region) {
    return NextResponse.json({ error: 'email and region are required' }, { status: 400 });
  }

  if (!siteUrl) {
    return NextResponse.json({ error: 'Server misconfiguration: SIMPLIFI_APP_URL is not set' }, { status: 500 });
  }

  const supabase = createServiceClient();
  const resolvedName = name || email.split('@')[0];

  // Generate magic link without triggering Supabase's rate-limited email.
  // redirectTo routes through /auth/callback so the PKCE code is exchanged
  // before the user lands at /onboarding — avoids the extra redirect hop.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=/onboarding`,
      data: { name: resolvedName },
    },
  });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  const { error: insertError } = await supabase.from('users').insert({
    id:               linkData.user.id,
    email,
    name:             resolvedName,
    role:             'COORDINATOR',
    status:           'PENDING',
    region,
    invited_by:       auth.user.id,
    max_weekly_hours: 20,
  });

  if (insertError) {
    await supabase.auth.admin.deleteUser(linkData.user.id);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const actionLink = linkData.properties.action_link;
  if (!actionLink) {
    await supabase.auth.admin.deleteUser(linkData.user.id);
    return NextResponse.json({ error: 'Failed to generate invite link' }, { status: 500 });
  }

  const emailResult = await sendInviteEmail(email, resolvedName, actionLink);
  if (!emailResult.ok) {
    return NextResponse.json({ error: `User created but email failed: ${emailResult.error}` }, { status: 500 });
  }

  return NextResponse.json({
    id:      linkData.user.id,
    name:    resolvedName,
    message: `Invite sent to ${email}`,
  });
}
