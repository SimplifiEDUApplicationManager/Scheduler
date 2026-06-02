import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendInviteEmail } from '@/lib/resend/emails';

const siteUrl = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: userRow, error: fetchError } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', id)
    .single();

  if (fetchError || !userRow) {
    return NextResponse.json({ error: 'Coordinator not found' }, { status: 404 });
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: userRow.email,
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=/onboarding`,
    },
  });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  const actionLink = linkData.properties.action_link;
  if (!actionLink) {
    return NextResponse.json({ error: 'Failed to generate invite link' }, { status: 500 });
  }

  const recipientName = userRow.name ?? userRow.email.split('@')[0];
  const emailResult = await sendInviteEmail(userRow.email, recipientName, actionLink);
  if (!emailResult.ok) {
    return NextResponse.json({ error: `Failed to send email: ${emailResult.error}` }, { status: 500 });
  }

  return NextResponse.json({ message: `Invite to ${userRow.email} resent` });
}
