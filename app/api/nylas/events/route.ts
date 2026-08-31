import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fetchTutorEvents, weekRange } from '@/lib/nylas/events';
import type { EventOverride } from '@/lib/types/domain';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const weekOffset = parseInt(searchParams.get('weekOffset') ?? '0', 10);

  if (!Number.isFinite(weekOffset) || Math.abs(weekOffset) > 52) {
    return NextResponse.json({ error: 'Invalid weekOffset' }, { status: 400 });
  }

  // Fetch user row and overrides in parallel.
  const [userResult, overridesResult] = await Promise.all([
    supabase.from('users').select('nylas_grant_id, timezone, selected_calendar_ids').eq('id', user.id).single(),
    supabase.from('event_overrides').select('nylas_event_id, master_event_id, counted').eq('user_id', user.id),
  ]);

  const { data: row, error } = userResult;
  if (error || !row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!row.nylas_grant_id) {
    return NextResponse.json([]);
  }

  const overrides: EventOverride[] = (overridesResult.data ?? []).map(o => ({
    nylas_event_id: o.nylas_event_id,
    master_event_id: o.master_event_id,
    counted: o.counted,
  }));

  const tz = row.timezone ?? 'UTC';
  const { startUnix, endUnix } = weekRange(weekOffset);
  const selectedCalendarIds = (row.selected_calendar_ids as string[] | null) ?? null;
  const events = await fetchTutorEvents(row.nylas_grant_id, startUnix, endUnix, tz, overrides, selectedCalendarIds);

  return NextResponse.json(events);
}
