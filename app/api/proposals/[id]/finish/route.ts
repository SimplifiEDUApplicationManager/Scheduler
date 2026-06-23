import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/proposals/[id]/finish
 * Tutor marks an accepted proposal as finished (engagement complete).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const svc = createServiceClient();

  const { data: proposal } = await svc
    .from('proposals')
    .select('status, tutor_id')
    .eq('id', id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (auth.role === 'TUTOR' && proposal.tutor_id !== auth.user.id) {
    return NextResponse.json({ error: 'Not your proposal' }, { status: 403 });
  }

  if (proposal.status !== 'ACCEPTED') {
    return NextResponse.json({ error: 'Only accepted proposals can be marked finished' }, { status: 422 });
  }

  const { error } = await svc
    .from('proposals')
    .update({ status: 'FINISHED' })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id });
}
