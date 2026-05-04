import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/holds
 * Coordinator blocks time on a tutor's calendar. Creates an ACTIVE hold that
 * expires after 48 hours (TTL set by DB trigger) if not released or converted.
 *
 * Body: { tutor_id, start_utc, end_utc, reason, nylas_event_id? }
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
    return NextResponse.json({ error: 'Only coordinators can place holds', status: 403 }, { status: 403 });
  }

  if (caller.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account is not active', status: 403 }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;
  const { tutor_id, start_utc, end_utc, reason, nylas_event_id } = body;

  if (!tutor_id || !start_utc || !end_utc || !reason) {
    return NextResponse.json({ error: 'Missing required fields: tutor_id, start_utc, end_utc, reason', status: 400 }, { status: 400 });
  }

  if (typeof start_utc !== 'string' || typeof end_utc !== 'string') {
    return NextResponse.json({ error: 'start_utc and end_utc must be ISO 8601 strings', status: 400 }, { status: 400 });
  }

  if (new Date(end_utc) <= new Date(start_utc)) {
    return NextResponse.json({ error: 'end_utc must be after start_utc', status: 400 }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('holds')
    .insert({
      tutor_id:       tutor_id as string,
      coordinator_id: user.id,
      start_utc,
      end_utc,
      reason:         reason as string,
      nylas_event_id: (nylas_event_id as string | undefined) ?? null,
    })
    .select('id, expires_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, expires_at: data.expires_at }, { status: 201 });
}
