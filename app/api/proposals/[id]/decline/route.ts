import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/proposals/[id]/decline
 * Tutor declines a pending proposal with a required reason.
 * Body: { reason: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!caller || caller.role !== 'TUTOR') {
    return NextResponse.json({ error: 'Only tutors can decline proposals', status: 403 }, { status: 403 });
  }

  const body = await req.json() as { reason?: string };
  const reason = body.reason?.trim();
  if (!reason) {
    return NextResponse.json({ error: 'A decline reason is required', status: 400 }, { status: 400 });
  }

  const { id } = await params;

  // Verify ownership and pending status before updating
  const { data: existing } = await supabase
    .from('proposals')
    .select('id, status')
    .eq('id', id)
    .eq('tutor_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Proposal not found', status: 404 }, { status: 404 });
  }

  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: 'Proposal is already resolved', status: 409 }, { status: 409 });
  }

  const { error } = await supabase
    .from('proposals')
    .update({
      status:         'DECLINED',
      decline_reason: reason,
      resolved_at:    new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ id });
}
