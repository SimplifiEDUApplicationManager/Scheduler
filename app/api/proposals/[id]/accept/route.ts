import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { requireActiveRole } from '@/lib/auth';
import { acceptProposal, transitionHttpStatus } from '@/lib/data/proposals';
import { createTutoringEvent, tupleToUnix } from '@/lib/nylas/events';
import { createServiceClient } from '@/lib/supabase/server';
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
  const auth = await requireActiveRole(['TUTOR']);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let placements: Placement[] | undefined;
  try {
    const body = await req.json() as { placements?: Placement[] };
    placements = body.placements;
  } catch {
    // No body — proceed without placements; will use proposed times from DB.
  }

  const result = await acceptProposal(id, auth.user.id, auth.supabase);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, status: transitionHttpStatus(result) },
      { status: transitionHttpStatus(result) },
    );
  }

  // Side-effects run after the accept is committed; failures never block the response.
  await createBookingEvent(id, auth.user.id, auth.supabase, placements).catch(err => {
    console.error('[proposals/accept] Nylas booking failed:', err);
  });

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
