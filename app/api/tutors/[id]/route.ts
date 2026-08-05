import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

// DELETE — permanently remove a tutor and all their related data.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['SUPER_ADMIN', 'COORDINATOR']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: target } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', id)
    .single();

  if (!target || target.role !== 'TUTOR') {
    return NextResponse.json({ error: 'Tutor not found' }, { status: 404 });
  }

  await supabase.from('event_overrides').delete().eq('user_id', id);
  await supabase.from('tutor_subject_changes').delete().eq('tutor_id', id);
  await supabase.from('tutor_subjects').delete().eq('tutor_id', id);
  await supabase.from('tutor_context').delete().eq('tutor_id', id);
  await supabase.from('tutor_availability_requests').delete().eq('tutor_id', id);
  await supabase.from('proposals').delete().eq('tutor_id', id);

  const { error: rowError } = await supabase.from('users').delete().eq('id', id);
  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(id);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ message: `${target.name} has been removed` });
}
