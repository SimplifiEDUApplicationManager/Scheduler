import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import type { Json } from '@/lib/types/database';

/**
 * POST /api/proposals
 * Coordinator creates a proposal for a tutor.
 * Body: { tutor_id, student_name, student_email, subject, requested_schedule, timezone, start_date?, notes?, asana_task_id? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const body = await req.json() as Record<string, unknown>;
  const {
    tutor_id, student_name, student_email, subject,
    requested_schedule, timezone, start_date, notes, asana_task_id,
  } = body;

  if (!tutor_id || !student_name || !student_email || !subject || !requested_schedule || !timezone) {
    return NextResponse.json({ error: 'Missing required fields', status: 400 }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      tutor_id:           tutor_id as string,
      coordinator_id:     user.id,
      student_name:       student_name as string,
      student_email:      student_email as string,
      subject:            subject as string,
      requested_schedule: requested_schedule as Json,
      timezone:           timezone as string,
      start_date:         (start_date as string | undefined) ?? null,
      notes:              (notes as string | undefined) ?? null,
      asana_task_id:      (asana_task_id as string | undefined) ?? null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
