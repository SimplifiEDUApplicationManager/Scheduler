import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { acceptProposal, transitionHttpStatus } from '@/lib/data/proposals';

/**
 * POST /api/proposals/[id]/accept
 * Tutor accepts a pending proposal addressed to them.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await acceptProposal(id, auth.user.id, auth.supabase);

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: transitionHttpStatus(result) });
  }

  return NextResponse.json({ id });
}
