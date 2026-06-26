import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import type { Json } from '@/lib/types/database';
import { isValidRate } from '@/lib/utils/rate';

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
  const {
    student_name, student_email, subject, requested_schedule, timezone,
    start_date, end_date, notes, asana_task_id, asana_task_url, offered_rate,
    session_duration_minutes, sessions_per_week,
  } = body;

  if (!student_name || typeof student_name !== 'string') {
    return NextResponse.json({ error: 'student_name is required', status: 400 }, { status: 400 });
  }

  if (offered_rate !== undefined && !isValidRate(offered_rate)) {
    return NextResponse.json({ error: 'offered_rate must be 20, 25, 30, 35, or 40', status: 422 }, { status: 422 });
  }

  const baseRow = {
    coordinator_id:     user.id,
    source:             (typeof asana_task_id === 'string' ? 'asana' : 'manual') as 'asana' | 'manual',
    student_name:       student_name,
    student_email:      typeof student_email   === 'string' ? student_email   : '',
    subject:            typeof subject         === 'string' ? subject         : null,
    requested_schedule: requested_schedule != null ? (requested_schedule as Json) : null,
    timezone:           typeof timezone        === 'string' ? timezone        : null,
    start_date:         typeof start_date      === 'string' ? start_date      : null,
    end_date:           typeof end_date        === 'string' ? end_date        : null,
    notes:              typeof notes           === 'string' ? notes           : null,
    asana_task_id:      typeof asana_task_id   === 'string' ? asana_task_id   : null,
    asana_task_url:     typeof asana_task_url  === 'string' ? asana_task_url  : null,
    offered_rate:       isValidRate(offered_rate) ? offered_rate : null,
    session_duration_minutes: typeof session_duration_minutes === 'number' ? session_duration_minutes : 60,
    sessions_per_week:        typeof sessions_per_week === 'number' ? sessions_per_week : 1,
  };

  // Upsert when an asana_task_id is provided so re-running the skill is idempotent.
  // status is excluded from the upsert row so re-syncing does not overwrite an
  // already-matched or declined request back to 'open'.
  const query = typeof asana_task_id === 'string'
    ? supabase.from('requests').upsert(baseRow, { onConflict: 'asana_task_id', ignoreDuplicates: false }).select('id').single()
    : supabase.from('requests').insert({ ...baseRow, status: 'open' as const }).select('id').single();

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
