import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

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
    .select('email')
    .eq('id', id)
    .single();

  if (fetchError || !userRow) {
    return NextResponse.json({ error: 'Coordinator not found' }, { status: 404 });
  }

  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(userRow.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/onboarding`,
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  return NextResponse.json({ message: `Invite to ${userRow.email} resent` });
}
