import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { requireActiveRole } from '@/lib/auth';
import { acceptProposal, transitionHttpStatus } from '@/lib/data/proposals';
import { createTutoringEvent, tupleToUnix } from '@/lib/nylas/events';
import type { Database } from '@/lib/types/database';

type SupabaseInstance = ReturnType<typeof createServerClient<Database>>;

/**
 * POST /api/proposals/[id]/accept
 * Tutor accepts a pending proposal addressed to them.
 * On success, creates a Nylas calendar event (best-effort — the accept
 * is never blocked by Nylas availability or errors).
 *
 * DB migration required to persist the event ID:
 *   ALTER TABLE proposals ADD COLUMN nylas_event_id text;
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await acceptProposal(id, auth.user.id, auth.supabase);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, status: transitionHttpStatus(result) },
      { status: transitionHttpStatus(result) },
    );
  }

  // Create a Nylas calendar event for the first session. This runs after the
  // accept is committed so a Nylas failure never blocks the tutor's response.
  await createBookingEvent(id, auth.user.id, auth.supabase).catch(err => {
    console.error('[proposals/accept] Nylas booking failed:', err);
  });

  return NextResponse.json({ id });
}

async function createBookingEvent(
  proposalId: string,
  tutorId: string,
  supabase: SupabaseInstance,
): Promise<void> {
  const [{ data: proposal }, { data: tutor }] = await Promise.all([
    supabase
      .from('proposals')
      .select('student_name, student_email, subject, requested_schedule, timezone, start_date')
      .eq('id', proposalId)
      .single(),
    supabase
      .from('users')
      .select('nylas_grant_id, meeting_link')
      .eq('id', tutorId)
      .single(),
  ]);

  if (!proposal || !tutor?.nylas_grant_id) return;

  const schedule = (proposal.requested_schedule ?? []) as { day: number; start: number; end: number }[];
  const firstTuple = schedule[0];
  if (!firstTuple) return;

  const { startUnix, endUnix } = tupleToUnix(
    firstTuple.day,
    firstTuple.start,
    firstTuple.end,
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
  });

  if (nylasEventId) {
    await supabase
      .from('proposals')
      .update({ nylas_event_id: nylasEventId })
      .eq('id', proposalId);
  }
}
