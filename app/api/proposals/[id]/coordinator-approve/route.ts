import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { createTutoringEvent, tupleToUnix } from '@/lib/nylas/events';
import { convertTupleTimezone } from '@/lib/utils/timezone';
import { listAsanaSections, moveTaskToSection } from '@/lib/asana/client';
import type { Json } from '@/lib/types/database';

/**
 * POST /api/proposals/[id]/coordinator-approve
 * Coordinator schedules sessions and approves the proposal.
 *
 * Body: { placements: { day: number; start: number }[] }
 * Placements arrive in the coordinator's timezone and are converted to
 * the proposal timezone before saving + creating calendar events.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const svc = createServiceClient();

  const { data: proposal } = await svc
    .from('proposals')
    .select('status, tutor_id, student_name, student_email, subject, timezone, start_date, session_duration_minutes, request_id, asana_task_id, coordinator_id')
    .eq('id', id)
    .single();

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.status !== 'TUTOR_ACCEPTED') {
    return NextResponse.json({ error: 'Proposal is not awaiting client approval' }, { status: 422 });
  }

  // Parse placements from request body
  let bodyPlacements: { day: number; start: number }[] = [];
  try {
    const body = await req.json() as { placements?: { day: number; start: number }[] };
    bodyPlacements = body.placements ?? [];
  } catch {
    // No body — no placements
  }

  if (bodyPlacements.length === 0) {
    return NextResponse.json({ error: 'No session placements provided' }, { status: 422 });
  }

  // Convert placements from coordinator's TZ to proposal TZ
  const { data: coordRow } = await svc.from('users').select('timezone').eq('id', auth.user.id).single();
  const coordTz = coordRow?.timezone ?? 'America/New_York';
  const proposalTz = proposal.timezone;
  const durationHrs = (proposal.session_duration_minutes ?? 60) / 60;

  const normalisedPlacements = coordTz !== proposalTz
    ? bodyPlacements.map(pl => {
        const converted = convertTupleTimezone(
          { day: pl.day, start: pl.start, end: pl.start + durationHrs },
          coordTz,
          proposalTz,
        );
        return { day: converted.day, start: converted.start };
      })
    : bodyPlacements;

  // Move to ACCEPTED and save placements
  const { error } = await svc.from('proposals').update({
    status: 'ACCEPTED',
    placements: normalisedPlacements as unknown as Json,
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create calendar events
  if (proposal.tutor_id) {
    const { data: tutor } = await svc
      .from('users')
      .select('nylas_grant_id, meeting_link, email')
      .eq('id', proposal.tutor_id)
      .single();

    if (tutor?.nylas_grant_id) {
      let firstEventId: string | null = null;
      for (const pl of normalisedPlacements) {
        const { startUnix, endUnix } = tupleToUnix(
          pl.day, pl.start, pl.start + durationHrs,
          proposalTz, proposal.start_date,
        );
        const eventId = await createTutoringEvent(tutor.nylas_grant_id, {
          studentName: proposal.student_name, studentEmail: proposal.student_email,
          subject: proposal.subject, startUnix, endUnix,
          meetingLink: tutor.meeting_link ?? undefined, calendarId: tutor.email ?? undefined,
        });
        if (eventId && !firstEventId) firstEventId = eventId;
      }

      if (firstEventId) {
        await svc.from('proposals').update({ nylas_event_id: firstEventId }).eq('id', id);
      }
    }
  }

  // Match the request
  if (proposal.request_id) {
    await svc.from('requests')
      .update({ status: 'matched', matched_proposal_id: id })
      .eq('id', proposal.request_id);
  }

  // Move Asana task to Matched section
  if (proposal.asana_task_id && proposal.coordinator_id) {
    try {
      const { data: coord } = await svc.from('users')
        .select('asana_access_token, asana_project_id')
        .eq('id', proposal.coordinator_id).single();
      if (coord?.asana_access_token && coord?.asana_project_id) {
        const sectionsResult = await listAsanaSections(coord.asana_access_token, coord.asana_project_id);
        if (sectionsResult.ok) {
          const section = sectionsResult.data.find(s => /matched/i.test(s.name));
          if (section) await moveTaskToSection(coord.asana_access_token, section.gid, proposal.asana_task_id);
        }
      }
    } catch (err) {
      console.error('[coordinator-approve] Asana move failed:', err);
    }
  }

  return NextResponse.json({ id });
}
