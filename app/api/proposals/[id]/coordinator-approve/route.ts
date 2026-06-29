import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { createTutoringEvent, tupleToUnix } from '@/lib/nylas/events';
import { listAsanaSections, moveTaskToSection } from '@/lib/asana/client';

/**
 * POST /api/proposals/[id]/coordinator-approve
 * Coordinator approves after client confirms the tutor.
 * Creates calendar events and matches the request.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const svc = createServiceClient();

  const { data: proposal } = await svc
    .from('proposals')
    .select('status, tutor_id, student_name, student_email, subject, requested_schedule, timezone, start_date, session_duration_minutes, placements, request_id, asana_task_id, coordinator_id')
    .eq('id', id)
    .single();

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.status !== 'TUTOR_ACCEPTED') {
    return NextResponse.json({ error: 'Proposal is not awaiting client approval' }, { status: 422 });
  }

  // Move to ACCEPTED
  const { error } = await svc.from('proposals').update({ status: 'ACCEPTED' }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create calendar events (same logic as the old accept flow)
  if (proposal.tutor_id) {
    const { data: tutor } = await svc
      .from('users')
      .select('nylas_grant_id, meeting_link, email')
      .eq('id', proposal.tutor_id)
      .single();

    if (tutor?.nylas_grant_id) {
      const schedule = (proposal.requested_schedule ?? []) as { day: number; start: number; end: number }[];
      const durationHrs = (proposal.session_duration_minutes ?? 60) / 60;
      const savedPlacements = proposal.placements
        ? (proposal.placements as unknown as ({ day: number; start: number } | null)[])
        : null;
      const effectivePlacements = (savedPlacements && savedPlacements.length > 0)
        ? savedPlacements
        : schedule.length > 0 ? [{ day: schedule[0].day, start: schedule[0].start }] : [];

      let firstEventId: string | null = null;
      for (const pl of effectivePlacements) {
        if (!pl) continue;
        const { startUnix, endUnix } = tupleToUnix(
          pl.day, pl.start, pl.start + durationHrs,
          proposal.timezone, proposal.start_date,
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
