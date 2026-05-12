import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

/**
 * POST /api/tutor-subject-changes/[id]/approve
 * Coordinator approves a pending subject change.
 *
 * Effects by change_type:
 *   ADD    → inserts a new tutor_subjects row
 *   EDIT   → updates tutor_confidence + qualification_note; resets coordinator_confidence to UNPROVEN
 *   REMOVE → deletes the tutor_subjects row
 *
 * Then marks the change as APPROVED.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { id } = await params;

  // Fetch the change request
  const { data: change, error: fetchErr } = await supabase
    .from('tutor_subject_changes')
    .select('id, tutor_id, subject_id, tutor_subject_id, change_type, requested_confidence, requested_note, status')
    .eq('id', id)
    .single();

  if (fetchErr || !change) {
    return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
  }
  if (change.status !== 'PENDING') {
    return NextResponse.json({ error: `Change is already ${change.status}` }, { status: 409 });
  }

  // ── Apply the change ──────────────────────────────────────────────────────

  if (change.change_type === 'ADD') {
    const { error: insertErr } = await supabase
      .from('tutor_subjects')
      .insert({
        tutor_id:               change.tutor_id,
        subject_id:             change.subject_id,
        tutor_confidence:       change.requested_confidence ?? 'MEDIUM',
        coordinator_confidence: 'UNPROVEN',
        qualification_note:     change.requested_note,
      });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  if (change.change_type === 'EDIT') {
    if (!change.tutor_subject_id) {
      return NextResponse.json({ error: 'EDIT change is missing tutor_subject_id' }, { status: 500 });
    }
    const { error: updateErr } = await supabase
      .from('tutor_subjects')
      .update({
        tutor_confidence:       change.requested_confidence ?? 'MEDIUM',
        qualification_note:     change.requested_note,
        coordinator_confidence: 'UNPROVEN',
        graded_by:              null,
      })
      .eq('id', change.tutor_subject_id);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  }

  if (change.change_type === 'REMOVE') {
    if (!change.tutor_subject_id) {
      return NextResponse.json({ error: 'REMOVE change is missing tutor_subject_id' }, { status: 500 });
    }
    const { error: deleteErr } = await supabase
      .from('tutor_subjects')
      .delete()
      .eq('id', change.tutor_subject_id);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }
  }

  // ── Mark the change as APPROVED ───────────────────────────────────────────

  const { data: updated, error: approveErr } = await supabase
    .from('tutor_subject_changes')
    .update({ status: 'APPROVED', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status, reviewed_at')
    .single();

  if (approveErr) {
    return NextResponse.json({ error: approveErr.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
