import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

const VALID_TUTOR_CONF = ['HIGH', 'MEDIUM', 'LOW'] as const;

/**
 * PATCH /api/tutor-subjects/[id]
 * Tutor updates their self-reported confidence + qualification note.
 * Resets coordinator_confidence to UNPROVEN so the coordinator sees the change.
 * [id] is the tutor_subjects row id.
 * Body: { tutor_confidence: 'HIGH'|'MEDIUM'|'LOW', qualification_note: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const { tutor_confidence, qualification_note } = body;

  if (!tutor_confidence || !qualification_note) {
    return NextResponse.json({ error: 'Missing required fields: tutor_confidence, qualification_note', status: 400 }, { status: 400 });
  }
  if (!VALID_TUTOR_CONF.includes(tutor_confidence as typeof VALID_TUTOR_CONF[number])) {
    return NextResponse.json({ error: 'tutor_confidence must be HIGH, MEDIUM, or LOW', status: 400 }, { status: 400 });
  }
  if (typeof qualification_note !== 'string' || qualification_note.trim().length < 10) {
    return NextResponse.json({ error: 'qualification_note must be at least 10 characters', status: 400 }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('tutor_subjects')
    .select('id, tutor_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Subject claim not found', status: 404 }, { status: 404 });
  }
  if (existing.tutor_id !== user.id) {
    return NextResponse.json({ error: 'You can only edit your own subjects', status: 403 }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('tutor_subjects')
    .update({
      tutor_confidence,
      qualification_note: qualification_note.trim(),
      coordinator_confidence: 'UNPROVEN',
    })
    .eq('id', id)
    .select('id, tutor_confidence, coordinator_confidence, qualification_note')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json(data);
}

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
