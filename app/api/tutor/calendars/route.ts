import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { fetchWritableCalendars } from '@/lib/nylas/events';

/**
 * GET /api/tutor/calendars
 * Returns the tutor's writable Nylas calendars with their current selections.
 */
export async function GET() {
  const auth = await requireActiveRole(['TUTOR', 'COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { data: row, error } = await supabase
    .from('users')
    .select('nylas_grant_id, selected_calendar_ids')
    .eq('id', user.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!row.nylas_grant_id) {
    return NextResponse.json({ error: 'No calendar connected' }, { status: 400 });
  }

  const calendars = await fetchWritableCalendars(row.nylas_grant_id);
  const selectedIds = (row.selected_calendar_ids as string[] | null) ?? null;

  return NextResponse.json({
    calendars,
    selectedIds,
  });
}

/**
 * PATCH /api/tutor/calendars
 * Save the tutor's selected calendar IDs.
 * Body: { selectedIds: string[] }
 * Pass an empty array to select none (unlikely but valid).
 * Pass null to reset to "all calendars" (default).
 */
export async function PATCH(request: Request) {
  const auth = await requireActiveRole(['TUTOR', 'COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  let body: { selectedIds: string[] | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { selectedIds } = body;

  // Validate: must be null or an array of strings
  if (selectedIds !== null) {
    if (!Array.isArray(selectedIds) || !selectedIds.every(id => typeof id === 'string')) {
      return NextResponse.json({ error: 'selectedIds must be an array of strings or null' }, { status: 422 });
    }
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ selected_calendar_ids: selectedIds })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
