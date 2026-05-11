import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { listAsanaTasks } from '@/lib/asana/client';

/**
 * POST /api/coordinator/asana/sync
 * Fetches incomplete tasks from the coordinator's connected Asana project
 * and upserts them into the `requests` table (dedupe by asana_task_id).
 *
 * Returns { synced: number } — count of rows created or updated.
 */
export async function POST() {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { data: row } = await supabase
    .from('users')
    .select('asana_access_token, asana_project_id')
    .eq('id', user.id)
    .single();

  if (!row?.asana_access_token || !row?.asana_project_id) {
    return NextResponse.json(
      { error: 'Asana not connected', status: 400 },
      { status: 400 },
    );
  }

  const tasksResult = await listAsanaTasks(row.asana_access_token, row.asana_project_id);
  if (!tasksResult.ok) {
    return NextResponse.json(
      { error: tasksResult.error, status: 502 },
      { status: 502 },
    );
  }

  const tasks = tasksResult.data;
  if (tasks.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  const rows = tasks.map(t => ({
    coordinator_id:  user.id,
    asana_task_id:   t.gid,
    asana_task_url:  t.permalink_url,
    source:          'asana' as const,
    status:          'open',
    student_name:    t.name || 'Unnamed request',
    notes:           t.notes || null,
    start_date:      t.due_on || null,
  }));

  // Upsert on asana_task_id; only update mutable fields (not coordinator_id or status).
  const { error, count } = await supabase
    .from('requests')
    .upsert(rows, {
      onConflict: 'asana_task_id',
      ignoreDuplicates: false,
    })
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ synced: count ?? rows.length });
}
