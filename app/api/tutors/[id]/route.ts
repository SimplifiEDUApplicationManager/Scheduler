import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

// PATCH — toggle tutor status (ACTIVE ↔ DISABLED).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['SUPER_ADMIN', 'COORDINATOR']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const { status } = body as { status: string };

  if (!['ACTIVE', 'DISABLED'].includes(status)) {
    return NextResponse.json({ error: 'status must be ACTIVE or DISABLED' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify the target is actually a tutor
  const { data: target } = await supabase
    .from('users')
    .select('role')
    .eq('id', id)
    .single();

  if (!target || target.role !== 'TUTOR') {
    return NextResponse.json({ error: 'Tutor not found' }, { status: 404 });
  }

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
  return NextResponse.json({ message: `${updated?.name ?? 'Tutor'} ${verb}` });
}
