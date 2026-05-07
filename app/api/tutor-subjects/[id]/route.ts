import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

/**
 * DELETE /api/tutor-subjects/[id]
 * Tutor removes one of their own subject claims.
 * [id] is the tutor_subjects row id (not the subject_id).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR', 'COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, role, supabase } = auth;

  const { id } = await params;

  // Verify the row exists; tutors may only remove their own claims.
  const { data: existing } = await supabase
    .from('tutor_subjects')
    .select('id, tutor_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Subject claim not found', status: 404 }, { status: 404 });
  }

  if (role === 'TUTOR' && existing.tutor_id !== user.id) {
    return NextResponse.json({ error: 'You can only remove your own subjects', status: 403 }, { status: 403 });
  }

  const { error } = await supabase
    .from('tutor_subjects')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ id });
}
