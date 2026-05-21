import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

/**
 * DELETE /api/tutor/availability-request/[id]
 * Tutor cancels their own pending availability request.
 * Only the tutor who owns the request may cancel it.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { id } = await params;

  const { data: existing, error: fetchErr } = await supabase
    .from('tutor_availability_requests')
    .select('id, tutor_id, status')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (existing.tutor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: `Request is already ${existing.status}` }, { status: 409 });
  }

  const { error: deleteErr } = await supabase
    .from('tutor_availability_requests')
    .delete()
    .eq('id', id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
