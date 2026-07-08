import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendProposalUpdatedEmail } from '@/lib/resend/emails';
import { isValidRate } from '@/lib/utils/rate';

/**
 * PATCH /api/proposals/[id]
 * Coordinator edits a PENDING or TUTOR_ACCEPTED proposal.
 * Resets status to PENDING, clears placements, resets expiry timer.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const svc = createServiceClient();

  // Fetch current proposal
  const { data: proposal } = await svc
    .from('proposals')
    .select('status, tutor_id, student_name, subject')
    .eq('id', id)
    .single();

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.status !== 'PENDING' && proposal.status !== 'TUTOR_ACCEPTED') {
    return NextResponse.json({ error: 'Only PENDING or TUTOR_ACCEPTED proposals can be edited' }, { status: 422 });
  }

  const body = await req.json() as Record<string, unknown>;

  // Build the update object from allowed fields
  const update: Record<string, unknown> = {
    status: 'PENDING',
    placements: null,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const FIELD_MAP: Record<string, string> = {
    student_name:  'student_name',
    student_email: 'student_email',
    subject:       'subject',
    requested_schedule: 'requested_schedule',
    timezone:      'timezone',
    start_date:    'start_date',
    notes:         'notes',
    offered_rate:  'offered_rate',
    session_duration_minutes: 'session_duration_minutes',
    sessions_per_week: 'sessions_per_week',
  };

  for (const [bodyKey, colName] of Object.entries(FIELD_MAP)) {
    if (bodyKey in body) {
      update[colName] = body[bodyKey] ?? null;
    }
  }

  // Validate offered_rate if provided
  if ('offered_rate' in update && update.offered_rate != null && !isValidRate(update.offered_rate)) {
    return NextResponse.json({ error: 'offered_rate must be a valid rate' }, { status: 422 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await svc.from('proposals').update(update as any).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send "Proposal updated" email to the tutor
  if (proposal.tutor_id) {
    const { data: tutor } = await svc.from('users').select('email, name').eq('id', proposal.tutor_id).single();
    const appUrl = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
    if (tutor && appUrl) {
      sendProposalUpdatedEmail(
        tutor.email,
        tutor.name ?? tutor.email.split('@')[0],
        (update.student_name as string) ?? proposal.student_name,
        (update.subject as string) ?? proposal.subject,
        appUrl,
      ).catch(err => {
        console.error('[proposals/edit] update email failed:', err);
      });
    }
  }

  return NextResponse.json({ id });
}
