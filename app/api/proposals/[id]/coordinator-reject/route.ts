import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendClientDeclinedEmail } from '@/lib/resend/emails';

/**
 * POST /api/proposals/[id]/coordinator-reject
 * Coordinator rejects after client did not approve the tutor.
 * Sets status to CLIENT_DECLINED and reopens the linked request.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const svc = createServiceClient();

  const { data: proposal } = await svc
    .from('proposals')
    .select('status, request_id, tutor_id, student_name, subject')
    .eq('id', id)
    .single();

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.status !== 'TUTOR_ACCEPTED') {
    return NextResponse.json({ error: 'Proposal is not awaiting client approval' }, { status: 422 });
  }

  const { error } = await svc.from('proposals')
    .update({ status: 'CLIENT_DECLINED' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reopen the linked request
  if (proposal.request_id) {
    await svc.from('requests')
      .update({ status: 'open', matched_proposal_id: null })
      .eq('id', proposal.request_id);
  }

  // Notify the tutor that the client declined
  if (proposal.tutor_id) {
    const { data: tutor } = await svc.from('users').select('email, name').eq('id', proposal.tutor_id).single();
    const appUrl = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
    if (tutor && appUrl) {
      sendClientDeclinedEmail(tutor.email, tutor.name, proposal.student_name, proposal.subject, appUrl).catch(() => {});
    }
  }

  return NextResponse.json({ id });
}
