import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/tutor-subjects
 * Tutor claims a subject, creating an UNPROVEN tutor_subject record.
 * Body: { subject_id, qualification_note }
 */
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'Only tutors can add subjects to their profile', status: 403 }, { status: 403 });
  }

  if (caller.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account is not active', status: 403 }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;
  const { subject_id, qualification_note } = body;

  if (!subject_id || !qualification_note) {
    return NextResponse.json({ error: 'Missing required fields: subject_id, qualification_note', status: 400 }, { status: 400 });
  }

  if (typeof subject_id !== 'string' || typeof qualification_note !== 'string') {
    return NextResponse.json({ error: 'subject_id and qualification_note must be strings', status: 400 }, { status: 400 });
  }

  if (qualification_note.trim().length < 10) {
    return NextResponse.json({ error: 'qualification_note must be at least 10 characters', status: 400 }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tutor_subjects')
    .insert({
      tutor_id:           user.id,
      subject_id,
      confidence:         'UNPROVEN',
      qualification_note: qualification_note.trim(),
    })
    .select('id, subject_id, confidence, qualification_note')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already added this subject', status: 409 }, { status: 409 });
    }
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
