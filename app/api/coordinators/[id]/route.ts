import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

// DELETE — revoke a pending invite by deleting the auth user.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: userRow } = await supabase
    .from('users')
    .select('email')
    .eq('id', id)
    .single();

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Delete public row in case there's no cascade.
  await supabase.from('users').delete().eq('id', id);

  return NextResponse.json({
    message: `Invite to ${userRow?.email ?? 'coordinator'} revoked`,
  });
}

// PATCH — update coordinator status (ACTIVE ↔ DISABLED).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const { status } = body as { status: string };

  if (!['ACTIVE', 'DISABLED'].includes(status)) {
    return NextResponse.json({ error: 'status must be ACTIVE or DISABLED' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: updated, error } = await supabase
    .from('users')
    .update({ status: status as 'ACTIVE' | 'DISABLED' })
    .eq('id', id)
    .select('name')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const verb = status === 'ACTIVE' ? 'reactivated' : 'deactivated';
  return NextResponse.json({ message: `${updated?.name ?? 'Coordinator'} ${verb}` });
}
