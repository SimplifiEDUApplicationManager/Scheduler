import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

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

  const supabase = createServiceClient();

  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/onboarding`,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const resolvedName = name || email.split('@')[0];

  const { error: insertError } = await supabase.from('users').insert({
    id:               authData.user.id,
    email,
    name:             resolvedName,
    role:             'COORDINATOR',
    status:           'PENDING',
    region,
    invited_by:       auth.user.id,
    max_weekly_hours: 20, // default; coordinator updates after onboarding
  });

  if (insertError) {
    // Best-effort cleanup — don't leave a dangling auth user.
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    id:      authData.user.id,
    name:    resolvedName,
    message: `Invite sent to ${email}`,
  });
}
