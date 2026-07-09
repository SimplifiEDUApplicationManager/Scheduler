import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { acceptProposal, transitionHttpStatus } from '@/lib/data/proposals';
import { createServiceClient } from '@/lib/supabase/server';
import { convertTupleTimezone } from '@/lib/utils/timezone';
import type { Json } from '@/lib/types/database';

/**
 * POST /api/proposals/[id]/accept
 * Tutor accepts a pending proposal.
 *
 * Sets status to TUTOR_ACCEPTED and saves the tutor's chosen placements.
 * Calendar events and request matching happen later when the coordinator
 * approves via POST /api/proposals/[id]/coordinator-approve.
 */
type Placement = { day: number; start: number } | null;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let placements: Placement[] | undefined;
  try {
    const body = await req.json() as { placements?: Placement[] };
    placements = body.placements;
  } catch {
    // No body — proceed without placements; will use proposed times from DB.
  }

  // For TUTOR the caller IS the tutor. For SUPER_ADMIN look up the proposal's
  // tutor_id so ownership checks use the right user.
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

  const result = await acceptProposal(id, tutorId, auth.supabase);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, status: transitionHttpStatus(result) },
      { status: transitionHttpStatus(result) },
    );
  }

  // Save placements for later (coordinator approval creates the calendar events).
  // Placements arrive in the tutor's timezone (they picked slots on their local calendar).
  // Convert back to the student/proposal timezone so placements + proposal.timezone are consistent.
  if (placements && placements.length > 0) {
    const svc = createServiceClient();
    const { data: proposalRow } = await svc
      .from('proposals')
      .select('timezone, session_duration_minutes')
      .eq('id', id)
      .single();
    const { data: tutorRow } = await svc
      .from('users')
      .select('timezone')
      .eq('id', tutorId)
      .single();
    const proposalTz = proposalRow?.timezone;
    const tutorTz = tutorRow?.timezone;
    const durationHrs = (proposalRow?.session_duration_minutes ?? 60) / 60;

    let normalised = placements;
    if (tutorTz && proposalTz && tutorTz !== proposalTz) {
      normalised = placements.map(pl => {
        if (!pl) return pl;
        const converted = convertTupleTimezone(
          { day: pl.day, start: pl.start, end: pl.start + durationHrs },
          tutorTz,
          proposalTz,
        );
        return { day: converted.day, start: converted.start };
      });
    }
    await svc.from('proposals').update({ placements: normalised as unknown as Json }).eq('id', id);
  }

  return NextResponse.json({ id });
}
