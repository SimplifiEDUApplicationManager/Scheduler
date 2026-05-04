import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/types/database';

/**
 * POST /api/proposals
 * Coordinator creates a proposal for a tutor.
 * Body: { tutor_id, student_name, student_email, subject, requested_schedule, timezone, start_date?, notes?, asana_task_id? }
 */
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'Only coordinators can create proposals', status: 403 }, { status: 403 });
  }

  if (caller.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account is not active', status: 403 }, { status: 403 });
  }

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
