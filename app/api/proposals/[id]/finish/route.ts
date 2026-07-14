import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { deleteRecurringTutoringEvent } from '@/lib/nylas/events';

/**
 * POST /api/proposals/[id]/finish
 * Tutor marks an accepted proposal as finished (engagement complete).
 * Also removes the recurring calendar event (best-effort).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['TUTOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const svc = createServiceClient();

  const { data: proposal } = await svc
    .from('proposals')
    .select('status, tutor_id, nylas_event_id, student_name, subject')
    .eq('id', id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (auth.role === 'TUTOR' && proposal.tutor_id !== auth.user.id) {
    return NextResponse.json({ error: 'Not your proposal' }, { status: 403 });
  }

  if (proposal.status !== 'ACCEPTED') {
    return NextResponse.json({ error: 'Only accepted proposals can be marked finished' }, { status: 422 });
  }

  const { error } = await svc
    .from('proposals')
    .update({ status: 'FINISHED' })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Delete the calendar event and all its spawned recurring instances
  // so sessions stop appearing on the tutor's calendar and counting
  // toward their capacity.
  if (proposal.nylas_event_id && proposal.tutor_id) {
    const { data: tutor } = await svc
      .from('users')
      .select('nylas_grant_id, email')
      .eq('id', proposal.tutor_id)
      .single();

    if (tutor?.nylas_grant_id) {
      deleteRecurringTutoringEvent(
        tutor.nylas_grant_id,
        proposal.nylas_event_id,
        proposal.student_name,
        proposal.subject,
        tutor.email ?? undefined,
      ).catch(err => {
        console.error('[proposals/finish] delete events threw:', err);
      });
    }
  }

  return NextResponse.json({ id });
}
