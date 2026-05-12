import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

const VALID_TUTOR_CONF = ['HIGH', 'MEDIUM', 'LOW'] as const;

/**
 * PATCH /api/tutor-subjects/[id]
 * Tutor requests a confidence edit. Creates a PENDING TutorSubjectChange (EDIT)
 * for coordinator review. The tutor_subjects row is unchanged until approved.
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
    return NextResponse.json(
      { error: 'Missing required fields: tutor_confidence, qualification_note' },
      { status: 400 },
    );
  }
  if (!VALID_TUTOR_CONF.includes(tutor_confidence as typeof VALID_TUTOR_CONF[number])) {
    return NextResponse.json({ error: 'tutor_confidence must be HIGH, MEDIUM, or LOW' }, { status: 400 });
  }
  if (typeof qualification_note !== 'string' || qualification_note.trim().length < 10) {
    return NextResponse.json({ error: 'qualification_note must be at least 10 characters' }, { status: 400 });
  }

  // Verify the row belongs to this tutor and fetch subject_id
  const { data: existing } = await supabase
    .from('tutor_subjects')
    .select('id, tutor_id, subject_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Subject claim not found' }, { status: 404 });
  }
  if (existing.tutor_id !== user.id) {
    return NextResponse.json({ error: 'You can only edit your own subjects' }, { status: 403 });
  }

  // Submit as a change request pending coordinator approval
  const { data, error } = await supabase
    .from('tutor_subject_changes')
    .insert({
      tutor_id:             user.id,
      subject_id:           existing.subject_id,
      tutor_subject_id:     id,
      change_type:          'EDIT',
      requested_confidence: tutor_confidence as string,
      requested_note:       (qualification_note as string).trim(),
      status:               'PENDING',
    })
    .select('id, change_type, requested_confidence, requested_note, status, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A pending change for this subject already exists. Wait for coordinator review.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/tutor-subjects/[id]
 * Tutor requests subject removal. Creates a PENDING TutorSubjectChange (REMOVE)
 * for coordinator review. Coordinators and super admins delete directly.
 * [id] is the tutor_subjects row id.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR', 'COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, role, supabase } = auth;

  const { id } = await params;

  const { data: existing } = await supabase
    .from('tutor_subjects')
    .select('id, tutor_id, subject_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Subject claim not found' }, { status: 404 });
  }

  if (role === 'TUTOR') {
    // Tutors request removal — goes to approval queue
    if (existing.tutor_id !== user.id) {
      return NextResponse.json({ error: 'You can only remove your own subjects' }, { status: 403 });
    }

    const removeBody = await req.json().catch(() => ({})) as { reason?: string };
    const reason = typeof removeBody.reason === 'string' ? removeBody.reason.trim() : null;

    const { data, error } = await supabase
      .from('tutor_subject_changes')
      .insert({
        tutor_id:         user.id,
        subject_id:       existing.subject_id,
        tutor_subject_id: id,
        change_type:      'REMOVE',
        requested_note:   reason ?? null,
        status:           'PENDING',
      })
      .select('id, change_type, status, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A pending change for this subject already exists. Wait for coordinator review.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }

  // Coordinators and super admins delete directly
  const { error } = await supabase
    .from('tutor_subjects')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id });
}
