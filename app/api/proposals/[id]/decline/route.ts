import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { declineProposal, transitionHttpStatus } from '@/lib/data/proposals';
import { createServiceClient } from '@/lib/supabase/server';
import { sendTutorDeclinedEmail } from '@/lib/resend/emails';

/**
 * POST /api/proposals/[id]/decline
 * Tutor declines a pending proposal with a required reason.
 * Body: { reason: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR']);
  if (!auth.ok) return auth.response;

  const body = await req.json() as { reason?: string };
  const reason = body.reason?.trim();
  if (!reason) {
    return NextResponse.json({ error: 'A decline reason is required' }, { status: 400 });
  }

  const { id } = await params;
  const result = await declineProposal(id, auth.user.id, reason, auth.supabase);

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: transitionHttpStatus(result) });
  }

  // Reopen the linked request so coordinators can reassign
  const svc = createServiceClient();
  const { data: proposal } = await svc
    .from('proposals')
    .select('request_id')
    .eq('id', id)
    .single();

  if (proposal?.request_id) {
    await svc
      .from('requests')
      .update({ status: 'open', matched_proposal_id: null })
      .eq('id', proposal.request_id);
  }

  // Notify the coordinator that the tutor declined
  const { data: fullProposal } = await svc
    .from('proposals')
    .select('student_name, subject, coordinator_id')
    .eq('id', id)
    .single();
  if (fullProposal?.coordinator_id) {
    const { data: coord } = await svc.from('users').select('email, name').eq('id', fullProposal.coordinator_id).single();
    const { data: tutorInfo } = await svc.from('users').select('name').eq('id', auth.user.id).single();
    const appUrl = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
    if (coord && tutorInfo && appUrl) {
      const emailResult = await sendTutorDeclinedEmail(coord.email, coord.name, tutorInfo.name, fullProposal.student_name, fullProposal.subject, reason, appUrl);
      if (!emailResult.ok) console.error('[decline] email failed:', emailResult.error);
    }
  }

  return NextResponse.json({ id });
}
