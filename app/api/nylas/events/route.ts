import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fetchTutorEvents, weekRange } from '@/lib/nylas/events';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const weekOffset = parseInt(searchParams.get('weekOffset') ?? '0', 10);

  if (!Number.isFinite(weekOffset) || Math.abs(weekOffset) > 52) {
    return NextResponse.json({ error: 'Invalid weekOffset' }, { status: 400 });
  }

  // Fetch the tutor's grant_id and timezone from DB.
  const { data: row, error } = await supabase
    .from('users')
    .select('nylas_grant_id, timezone')
    .eq('id', user.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!row.nylas_grant_id) {
    // Calendar not connected yet — return empty array rather than an error
    // so the UI degrades gracefully.
    return NextResponse.json([]);
  }

  const tz = row.timezone ?? 'UTC';
  const { startUnix, endUnix } = weekRange(weekOffset);
  const events = await fetchTutorEvents(row.nylas_grant_id, startUnix, endUnix, tz);

  return NextResponse.json(events);
}
