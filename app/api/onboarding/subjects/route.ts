import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/onboarding/subjects
 * Body: { subjectIds: string[] }  — UUIDs from the public.subjects table
 *
 * Bulk-upserts tutor_subjects rows (confidence = UNPROVEN for self-declared subjects)
 * then marks the tutor as ACTIVE, completing their onboarding.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { subjectIds: string[] };
  const { subjectIds } = body;

  if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
    return NextResponse.json({ error: 'At least one subject is required' }, { status: 400 });
  }

  // Upsert one row per subject — confidence starts at UNPROVEN; coordinator grades later.
  const rows = subjectIds.map(subjectId => ({
    tutor_id:   user.id,
    subject_id: subjectId,
    confidence: 'UNPROVEN' as const,
  }));

  const { error: upsertError } = await supabase
    .from('tutor_subjects')
    .upsert(rows, { onConflict: 'tutor_id,subject_id', ignoreDuplicates: false });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Mark the tutor's account as ACTIVE — they're done with onboarding.
  const { error: activateError } = await supabase
    .from('users')
    .update({ status: 'ACTIVE' })
    .eq('id', user.id);

  if (activateError) {
    return NextResponse.json({ error: activateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
