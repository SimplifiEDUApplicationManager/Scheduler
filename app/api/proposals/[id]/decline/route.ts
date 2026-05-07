import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { declineProposal, transitionHttpStatus } from '@/lib/data/proposals';

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

  return NextResponse.json({ id });
}
