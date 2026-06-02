import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { requireActiveRole } from '@/lib/auth';
import { acceptProposal, transitionHttpStatus } from '@/lib/data/proposals';
import { createTutoringEvent, tupleToUnix } from '@/lib/nylas/events';
import { createServiceClient } from '@/lib/supabase/server';
import { listAsanaSections, moveTaskToSection } from '@/lib/asana/client';
import type { Database } from '@/lib/types/database';

type SupabaseInstance = ReturnType<typeof createServerClient<Database>>;

/**
 * POST /api/proposals/[id]/accept
 * Tutor accepts a pending proposal addressed to them.
 * On success, creates a Nylas calendar event (best-effort).
 * Failure does not block the accept — logged only.
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
  // tutor_id so ownership checks and Nylas booking use the right user.
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

  // Side-effects run after the accept is committed; failures never block the response.
  await Promise.all([
    createBookingEvent(id, tutorId, auth.supabase, placements).catch(err => {
      console.error('[proposals/accept] Nylas booking failed:', err);
    }),
    matchRequestOnAccept(id).catch(err => {
      console.error('[proposals/accept] Request matching failed:', err);
    }),
  ]);

  return NextResponse.json({ id });
}

async function createBookingEvent(
  proposalId: string,
  tutorId: string,
  supabase: SupabaseInstance,
  placements?: Placement[],
): Promise<void> {
  const [{ data: proposal }, { data: tutor }] = await Promise.all([
    supabase
      .from('proposals')
      .select('student_name, student_email, subject, requested_schedule, timezone, start_date')
      .eq('id', proposalId)
      .single(),
    supabase
      .from('users')
      .select('nylas_grant_id, meeting_link, email')
      .eq('id', tutorId)
      .single(),
  ]);

  if (!proposal || !tutor?.nylas_grant_id) {
    console.error('[proposals/accept] createBookingEvent early exit:', {
      hasProposal: !!proposal,
      hasGrantId: !!tutor?.nylas_grant_id,
      proposalId,
      tutorId,
    });
    return;
  }

  const schedule = (proposal.requested_schedule ?? []) as { day: number; start: number; end: number }[];
  if (schedule.length === 0) {
    console.error('[proposals/accept] createBookingEvent: empty schedule', { proposalId });
    return;
  }

  // One session per student. Use the tutor's confirmed placement if provided;
  // fall back to the start of the first availability window.
  const pl    = placements?.[0];
  const tp    = schedule[0];
  const day   = pl?.day   ?? tp.day;
  const start = pl?.start ?? tp.start;

  const { startUnix, endUnix } = tupleToUnix(
    day, start, start + 1, // 1-hr session
    proposal.timezone,
    proposal.start_date,
  );

  const nylasEventId = await createTutoringEvent(tutor.nylas_grant_id, {
    studentName:  proposal.student_name,
    studentEmail: proposal.student_email,
    subject:      proposal.subject,
    startUnix,
    endUnix,
    meetingLink: tutor.meeting_link ?? undefined,
    calendarId:  tutor.email ?? undefined,
  });

  let savedEventId = nylasEventId ?? null;

  if (savedEventId) {
    await supabase
      .from('proposals')
      .update({ nylas_event_id: savedEventId })
      .eq('id', proposalId);
  }
}

/**
 * After a proposal is accepted:
 *   1. Find the linked request (via asana_task_id or coordinator+student+subject match).
 *   2. Mark it as 'matched' and set matched_proposal_id.
 *   3. If the request came from Asana, move the task to the "Matched" section.
 */
async function matchRequestOnAccept(proposalId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, asana_task_id, coordinator_id, student_email, subject')
    .eq('id', proposalId)
    .single();

  if (!proposal) return;

  // Find the linked open request — asana_task_id match first, then fuzzy fallback.
  let requestId: string | null = null;

  if (proposal.asana_task_id) {
    const { data: req } = await supabase
      .from('requests')
      .select('id')
      .eq('asana_task_id', proposal.asana_task_id)
      .eq('status', 'open')
      .maybeSingle();
    requestId = req?.id ?? null;
  }

  if (!requestId && proposal.coordinator_id && proposal.student_email) {
    let q = supabase
      .from('requests')
      .select('id')
      .eq('coordinator_id', proposal.coordinator_id)
      .eq('student_email', proposal.student_email)
      .eq('status', 'open')
      .limit(1);
    // PostgREST requires .is() for null equality, not .eq()
    if (proposal.subject === null) {
      q = q.is('subject', null);
    } else {
      q = q.eq('subject', proposal.subject);
    }
    const { data: req } = await q.maybeSingle();
    requestId = req?.id ?? null;
  }

  if (requestId) {
    await supabase
      .from('requests')
      .update({ status: 'matched', matched_proposal_id: proposalId })
      .eq('id', requestId);

    // Move the Asana task to the "Matched" section only after DB is updated (best-effort).
    if (proposal.asana_task_id && proposal.coordinator_id) {
      await moveAsanaTaskToMatched(
        supabase,
        proposal.coordinator_id,
        proposal.asana_task_id,
      ).catch(err => {
        console.error('[proposals/accept] Asana section move failed:', err);
      });
    }
  } else {
    console.error('[proposals/accept] matchRequestOnAccept: no open request found for proposal', { proposalId });
  }
}

async function moveAsanaTaskToMatched(
  supabase: ReturnType<typeof createServiceClient>,
  coordinatorId: string,
  taskGid: string,
): Promise<void> {
  const { data: coord } = await supabase
    .from('users')
    .select('asana_access_token, asana_project_id')
    .eq('id', coordinatorId)
    .single();

  if (!coord?.asana_access_token || !coord?.asana_project_id) return;

  const sectionsResult = await listAsanaSections(
    coord.asana_access_token,
    coord.asana_project_id,
  );
  if (!sectionsResult.ok) {
    console.error('[proposals/accept] listAsanaSections failed:', sectionsResult.error);
    return;
  }

  const section = sectionsResult.data.find(s => /matched/i.test(s.name));
  if (!section) {
    console.error('[proposals/accept] "Matched" section not found in project', coord.asana_project_id);
    return;
  }

  await moveTaskToSection(coord.asana_access_token, section.gid, taskGid);
}
