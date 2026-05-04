import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/tutor-subjects/[id]
 * Tutor removes one of their own subject claims.
 * [id] is the tutor_subjects row id (not the subject_id).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (!caller || caller.role !== 'TUTOR') {
    return NextResponse.json({ error: 'Only tutors can remove subjects from their profile', status: 403 }, { status: 403 });
  }

  if (caller.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account is not active', status: 403 }, { status: 403 });
  }

  const { id } = await params;

  // Verify ownership before deleting
  const { data: existing } = await supabase
    .from('tutor_subjects')
    .select('id, tutor_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Subject claim not found', status: 404 }, { status: 404 });
  }

  if (existing.tutor_id !== user.id) {
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
