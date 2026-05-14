import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import type { Json, Database } from '@/lib/types/database';

/**
 * DELETE /api/requests/[id]
 * Delete a request. Coordinators may only delete their own requests.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { id } = await params;

  const { data, error } = await supabase
    .from('requests')
    .delete()
    .eq('id', id)
    .eq('coordinator_id', user.id)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Not found', status: 404 }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

type RequestUpdate = Database['public']['Tables']['requests']['Update'];

/**
 * PATCH /api/requests/[id]
 * Update structured fields on a request (subject, schedule, timezone, etc.).
 * Coordinators may only update their own requests.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  // Only allow updating these specific fields.
  const patch: RequestUpdate = {};
  if (typeof body.student_name    === 'string') patch.student_name    = body.student_name;
  if (typeof body.student_email   === 'string') patch.student_email   = body.student_email;
  if (typeof body.subject         === 'string') patch.subject         = body.subject;
  if (typeof body.timezone        === 'string') patch.timezone        = body.timezone;
  if (typeof body.start_date      === 'string') patch.start_date      = body.start_date;
  if (typeof body.notes           === 'string') patch.notes           = body.notes;
  if (body.requested_schedule != null)          patch.requested_schedule = body.requested_schedule as Json;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update', status: 400 }, { status: 400 });
  }

  const { error } = await supabase
    .from('requests')
    .update(patch)
    .eq('id', id)
    .eq('coordinator_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
