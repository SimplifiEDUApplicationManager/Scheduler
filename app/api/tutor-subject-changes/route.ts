import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

const VALID_CONF       = ['HIGH', 'MEDIUM', 'LOW'] as const;
const VALID_TYPES      = ['ADD', 'EDIT', 'REMOVE'] as const;

/**
 * POST /api/tutor-subject-changes
 * Tutor submits a subject change request for coordinator approval.
 *
 * Body for ADD:    { change_type: 'ADD',    subject_id, requested_confidence, requested_note }
 * Body for EDIT:   { change_type: 'EDIT',   subject_id, tutor_subject_id, requested_confidence, requested_note }
 * Body for REMOVE: { change_type: 'REMOVE', subject_id, tutor_subject_id }
 *
 * Returns 409 if a PENDING change already exists for that tutor + subject.
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(['TUTOR']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const body = await req.json() as Record<string, unknown>;
  const { change_type, subject_id, tutor_subject_id, requested_confidence, requested_note } = body;

  // ── Basic validation ──────────────────────────────────────────────────────

  if (!change_type || !VALID_TYPES.includes(change_type as typeof VALID_TYPES[number])) {
    return NextResponse.json({ error: 'change_type must be ADD, EDIT, or REMOVE' }, { status: 400 });
  }
  if (!subject_id || typeof subject_id !== 'string') {
    return NextResponse.json({ error: 'subject_id is required' }, { status: 400 });
  }

  if (change_type === 'ADD') {
    if (!requested_confidence || !VALID_CONF.includes(requested_confidence as typeof VALID_CONF[number])) {
      return NextResponse.json({ error: 'ADD requires requested_confidence (HIGH, MEDIUM, or LOW)' }, { status: 400 });
    }
    if (!requested_note || typeof requested_note !== 'string' || requested_note.trim().length < 10) {
      return NextResponse.json({ error: 'ADD requires requested_note (min 10 chars)' }, { status: 400 });
    }
  }

  if (change_type === 'EDIT') {
    if (!tutor_subject_id || typeof tutor_subject_id !== 'string') {
      return NextResponse.json({ error: 'EDIT requires tutor_subject_id' }, { status: 400 });
    }
    if (!requested_confidence || !VALID_CONF.includes(requested_confidence as typeof VALID_CONF[number])) {
      return NextResponse.json({ error: 'EDIT requires requested_confidence (HIGH, MEDIUM, or LOW)' }, { status: 400 });
    }
    if (!requested_note || typeof requested_note !== 'string' || requested_note.trim().length < 10) {
      return NextResponse.json({ error: 'EDIT requires requested_note (min 10 chars)' }, { status: 400 });
    }
  }

  if (change_type === 'REMOVE') {
    if (!tutor_subject_id || typeof tutor_subject_id !== 'string') {
      return NextResponse.json({ error: 'REMOVE requires tutor_subject_id' }, { status: 400 });
    }
  }

  // ── Insert ────────────────────────────────────────────────────────────────

  const { data, error } = await supabase
    .from('tutor_subject_changes')
    .insert({
      tutor_id:             user.id,
      subject_id,
      tutor_subject_id:     (tutor_subject_id as string | undefined) ?? null,
      change_type:          change_type as string,
      requested_confidence: (requested_confidence as string | undefined) ?? null,
      requested_note:       requested_note ? (requested_note as string).trim() : null,
      status:               'PENDING',
    })
    .select('id, change_type, subject_id, tutor_subject_id, requested_confidence, requested_note, status, created_at')
    .single();

  if (error) {
    // Unique index violation — a pending change already exists for this subject
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A pending change already exists for this subject. Wait for coordinator review before submitting another.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
