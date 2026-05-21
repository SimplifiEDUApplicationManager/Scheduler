import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

/**
 * POST /api/tutor/availability-request/[id]/decline
 * Coordinator declines a pending availability request.
 * No side effects on users or Nylas — the tutor's current state is preserved.
 * Body: { decline_reason?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { decline_reason?: string };
  const decline_reason = typeof body.decline_reason === 'string' ? body.decline_reason.trim() : null;

  const { data: existing, error: fetchErr } = await supabase
    .from('tutor_availability_requests')
    .select('id, status')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: `Request is already ${existing.status}` }, { status: 409 });
  }

  const { data: updated, error: declineErr } = await supabase
    .from('tutor_availability_requests')
    .update({
      status:         'DECLINED',
      reviewed_by:    user.id,
      reviewed_at:    new Date().toISOString(),
      decline_reason: decline_reason ?? null,
    })
    .eq('id', id)
    .select('id, status, decline_reason, reviewed_at')
    .single();

  if (declineErr) return NextResponse.json({ error: declineErr.message }, { status: 500 });

  return NextResponse.json(updated);
}
