import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { acceptProposal, transitionHttpStatus } from '@/lib/data/proposals';
import { createServiceClient } from '@/lib/supabase/server';
import { convertTupleTimezone } from '@/lib/utils/timezone';
import { sendTutorAcceptedEmail } from '@/lib/resend/emails';
import type { Json } from '@/lib/types/database';

type TutorAvailRange = { day: number; start: number; end: number };

/**
 * POST /api/proposals/[id]/accept
 * Tutor accepts a pending proposal.
 *
 * Body: { tutor_availability: { day, start, end }[] }
 * The tutor's painted availability ranges (in their local timezone).
 *
 * Validates:
 *  - Each range >= session duration
 *  - Number of valid ranges >= sessions per week
 *  - Valid ranges on >= sessionsPerWeek distinct days
 *
 * Converts ranges from tutor TZ to proposal TZ, saves as tutor_availability.
 * Status → TUTOR_ACCEPTED. Calendar events created later by coordinator.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let tutorAvailability: TutorAvailRange[] | undefined;
  try {
    const body = await req.json() as { tutor_availability?: TutorAvailRange[] };
    tutorAvailability = body.tutor_availability;
  } catch {
    // No body
  }

  // For TUTOR the caller IS the tutor. For SUPER_ADMIN look up the proposal's tutor_id.
  let tutorId = auth.user.id;
  if (auth.role === 'SUPER_ADMIN') {
    const { data: proposal } = await auth.supabase
      .from('proposals')
      .select('tutor_id')
      .eq('id', id)
      .single();
    if (!proposal?.tutor_id) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }
    tutorId = proposal.tutor_id;
  }

  const svc = createServiceClient();
  const { data: proposalRow } = await svc
    .from('proposals')
    .select('timezone, session_duration_minutes, sessions_per_week')
    .eq('id', id)
    .single();

  if (!proposalRow) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const sessionDurationMin = proposalRow.session_duration_minutes ?? 60;
  const sessionsPerWeek = proposalRow.sessions_per_week ?? 1;
  const durationHrs = sessionDurationMin / 60;

  // Validate tutor_availability if provided
  if (tutorAvailability && tutorAvailability.length > 0) {
    const validBlocks = tutorAvailability.filter(r => (r.end - r.start) >= durationHrs);
    const distinctDays = new Set(validBlocks.map(b => b.day)).size;

    if (validBlocks.length < sessionsPerWeek) {
      return NextResponse.json({
        error: `Need at least ${sessionsPerWeek} availability block(s) that can fit a ${sessionDurationMin}min session — only ${validBlocks.length} provided`,
      }, { status: 422 });
    }

    if (distinctDays < sessionsPerWeek) {
      return NextResponse.json({
        error: `Need availability on at least ${sessionsPerWeek} distinct day(s) — only ${distinctDays} provided`,
      }, { status: 422 });
    }
  }

  // Accept the proposal (status → TUTOR_ACCEPTED)
  const result = await acceptProposal(id, tutorId, auth.supabase);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, status: transitionHttpStatus(result) },
      { status: transitionHttpStatus(result) },
    );
  }

  // Save tutor_availability, converting from tutor's TZ to proposal TZ
  if (tutorAvailability && tutorAvailability.length > 0) {
    const { data: tutorRow } = await svc
      .from('users')
      .select('timezone')
      .eq('id', tutorId)
      .single();

    const proposalTz = proposalRow.timezone;
    const tutorTz = tutorRow?.timezone;

    let normalised: TutorAvailRange[] = tutorAvailability;
    if (tutorTz && proposalTz && tutorTz !== proposalTz) {
      normalised = tutorAvailability.map(range => {
        const converted = convertTupleTimezone(
          { day: range.day, start: range.start, end: range.end },
          tutorTz,
          proposalTz,
        );
        return { day: converted.day, start: converted.start, end: converted.end };
      });
    }

    await svc.from('proposals').update({
      tutor_availability: normalised as unknown as Json,
    }).eq('id', id);
  }

  // Notify the coordinator that the tutor accepted
  const { data: fullProposal } = await svc
    .from('proposals')
    .select('student_name, subject, coordinator_id')
    .eq('id', id)
    .single();
  if (fullProposal?.coordinator_id) {
    const { data: coord } = await svc.from('users').select('email, name').eq('id', fullProposal.coordinator_id).single();
    const { data: tutorInfo } = await svc.from('users').select('name').eq('id', tutorId).single();
    const appUrl = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
    if (coord && tutorInfo && appUrl) {
      sendTutorAcceptedEmail(coord.email, coord.name, tutorInfo.name, fullProposal.student_name, fullProposal.subject, appUrl).catch(() => {});
    }
  }

  return NextResponse.json({ id });
}
