import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/holds/[id]/release
 * Coordinator releases an ACTIVE hold, freeing the blocked time.
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

  if (!caller || !['COORDINATOR', 'SUPER_ADMIN'].includes(caller.role)) {
    return NextResponse.json({ error: 'Only coordinators can release holds', status: 403 }, { status: 403 });
  }

  if (caller.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account is not active', status: 403 }, { status: 403 });
  }

  const { id } = await params;

  const { data: existing } = await supabase
    .from('holds')
    .select('id, status')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Hold not found', status: 404 }, { status: 404 });
  }

  if (existing.status !== 'ACTIVE') {
    return NextResponse.json({ error: `Hold is already ${existing.status.toLowerCase()}`, status: 409 }, { status: 409 });
  }

  const { error } = await supabase
    .from('holds')
    .update({ status: 'RELEASED' })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ id });
}
