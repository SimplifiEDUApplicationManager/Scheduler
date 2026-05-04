import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/proposals/[id]/accept
 * Tutor accepts a pending proposal addressed to them.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (!caller || caller.role !== 'TUTOR') {
    return NextResponse.json({ error: 'Only tutors can accept proposals', status: 403 }, { status: 403 });
  }

  if (caller.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account is not active', status: 403 }, { status: 403 });
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
    .update({ status: 'ACCEPTED', resolved_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ id });
}
