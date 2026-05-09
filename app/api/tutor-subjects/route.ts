import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

const VALID_TUTOR_CONF = ['HIGH', 'MEDIUM', 'LOW'] as const;

/**
 * POST /api/tutor-subjects
 * Tutor claims a subject with their self-reported confidence.
 * Body: { subject_id, qualification_note, tutor_confidence }
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(['TUTOR']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const body = await req.json() as Record<string, unknown>;
  const { subject_id, qualification_note, tutor_confidence } = body;

  if (!subject_id || !qualification_note || !tutor_confidence) {
    return NextResponse.json({ error: 'Missing required fields: subject_id, qualification_note, tutor_confidence', status: 400 }, { status: 400 });
  }

  if (typeof subject_id !== 'string' || typeof qualification_note !== 'string' || typeof tutor_confidence !== 'string') {
    return NextResponse.json({ error: 'subject_id, qualification_note, and tutor_confidence must be strings', status: 400 }, { status: 400 });
  }

  if (!VALID_TUTOR_CONF.includes(tutor_confidence as typeof VALID_TUTOR_CONF[number])) {
    return NextResponse.json({ error: 'tutor_confidence must be HIGH, MEDIUM, or LOW', status: 400 }, { status: 400 });
  }

  if (qualification_note.trim().length < 10) {
    return NextResponse.json({ error: 'qualification_note must be at least 10 characters', status: 400 }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tutor_subjects')
    .insert({
      tutor_id:               user.id,
      subject_id,
      tutor_confidence,
      coordinator_confidence: 'UNPROVEN',
      qualification_note:     qualification_note.trim(),
    })
    .select('id, subject_id, tutor_confidence, coordinator_confidence, qualification_note')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already added this subject', status: 409 }, { status: 409 });
    }
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
