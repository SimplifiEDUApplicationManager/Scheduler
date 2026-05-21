import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import type { AvailabilityRequestType } from '@/lib/types/domain';

const VALID_TYPES: AvailabilityRequestType[] = ['PAUSE', 'LOW_MAX_HOURS', 'LOW_AVAILABILITY_WINDOWS'];

/**
 * POST /api/tutor/availability-request
 * Tutor submits an availability change that requires coordinator approval.
 *
 * Body for PAUSE:
 *   { request_type: 'PAUSE', reason: string }
 *
 * Body for LOW_MAX_HOURS:
 *   { request_type: 'LOW_MAX_HOURS', reason: string, details: { requested_hours: number } }
 *
 * Body for LOW_AVAILABILITY_WINDOWS:
 *   { request_type: 'LOW_AVAILABILITY_WINDOWS', reason: string, details: { total_hours: number, prefs: SchedulerPrefs } }
 *
 * Returns 409 if a PENDING request of the same type already exists for this tutor.
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(['TUTOR']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const body = await req.json() as Record<string, unknown>;
  const { request_type, reason, details } = body;

  if (!request_type || !VALID_TYPES.includes(request_type as AvailabilityRequestType)) {
    return NextResponse.json({ error: 'request_type must be PAUSE, LOW_MAX_HOURS, or LOW_AVAILABILITY_WINDOWS' }, { status: 400 });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return NextResponse.json({ error: 'reason is required (min 5 chars)' }, { status: 400 });
  }

  if (request_type === 'LOW_MAX_HOURS') {
    const hrs = (details as Record<string, unknown> | undefined)?.requested_hours;
    if (typeof hrs !== 'number' || hrs < 1 || hrs > 5) {
      return NextResponse.json({ error: 'LOW_MAX_HOURS requires details.requested_hours between 1 and 5' }, { status: 400 });
    }
  }

  if (request_type === 'LOW_AVAILABILITY_WINDOWS') {
    const totalHrs = (details as Record<string, unknown> | undefined)?.total_hours;
    const prefs    = (details as Record<string, unknown> | undefined)?.prefs;
    if (typeof totalHrs !== 'number' || !prefs) {
      return NextResponse.json({ error: 'LOW_AVAILABILITY_WINDOWS requires details.total_hours and details.prefs' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('tutor_availability_requests')
    .insert({
      tutor_id:     user.id,
      request_type: request_type as string,
      reason:       reason.trim(),
      details:      details ?? null,
      status:       'PENDING',
    })
    .select('id, request_type, reason, details, status, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A pending request of this type already exists. Wait for coordinator review before submitting another.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
