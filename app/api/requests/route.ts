import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import type { Json } from '@/lib/types/database';

/**
 * GET /api/requests
 * Returns all requests for the signed-in coordinator, newest first.
 */
export async function GET() {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('coordinator_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/requests
 * Create a manual (non-Asana) tutoring request.
 *
 * Body: { student_name, student_email, subject?, requested_schedule?, timezone?, start_date?, notes? }
 * Returns: { id }
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const body = await req.json() as Record<string, unknown>;
  const { student_name, student_email, subject, requested_schedule, timezone, start_date, notes } = body;

  if (!student_name || typeof student_name !== 'string') {
    return NextResponse.json({ error: 'student_name is required', status: 400 }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('requests')
    .insert({
      coordinator_id:     user.id,
      source:             'manual',
      status:             'open',
      student_name:       student_name,
      student_email:      typeof student_email === 'string' ? student_email : '',
      subject:            typeof subject       === 'string' ? subject       : null,
      requested_schedule: requested_schedule != null ? (requested_schedule as Json) : null,
      timezone:           typeof timezone      === 'string' ? timezone      : null,
      start_date:         typeof start_date    === 'string' ? start_date    : null,
      notes:              typeof notes         === 'string' ? notes         : null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
