import { redirect } from 'next/navigation';
import { DEV_BYPASS } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { fetchAllTutors } from '@/lib/data/tutors';
import { ProposalsClient } from '@/components/features/proposals/ProposalsClient';
import type { Invitation, InvitationStatus } from '@/lib/types/domain';
import { convertTupleTimezone } from '@/lib/utils/timezone';

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'Just now';
  if (hours <  1) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_MAP: Record<string, InvitationStatus> = {
  PENDING:         'pending',
  TUTOR_ACCEPTED:  'tutor_accepted',
  ACCEPTED:        'accepted',
  DECLINED:        'declined',
  EXPIRED:         'expired',
  FINISHED:        'finished',
  CLIENT_DECLINED: 'client_declined',
};

export default async function ProposalsPage() {
  if (DEV_BYPASS) {
    const { INVITATIONS, TUTORS, REQUESTS } = await import('@/lib/data/mock');
    return <ProposalsClient invitations={INVITATIONS} tutors={TUTORS} requests={REQUESTS} />;
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [{ data: rows }, tutors, { data: coordRow }] = await Promise.all([
    supabase
      .from('proposals')
      .select('id, tutor_id, student_name, subject, status, decline_reason, created_at, resolved_at, placements, tutor_availability, requested_schedule, session_duration_minutes, sessions_per_week, timezone')
      .eq('coordinator_id', user.id)
      .order('created_at', { ascending: false }),
    fetchAllTutors(supabase),
    supabase.from('users').select('name, timezone').eq('id', user.id).single(),
  ]);

  const coordName = coordRow?.name ?? 'Coordinator';
  const coordTz = coordRow?.timezone ?? 'America/New_York';

  const invitations: Invitation[] = (rows ?? []).map(row => {
    const rawPlacements = row.placements as { day: number; start: number }[] | null;
    const rawTutorAvail = row.tutor_availability as { day: number; start: number; end: number }[] | null;
    // Fall back to requested_schedule for old-flow proposals without tutor_availability
    const rawSchedule = row.requested_schedule as { day: number; start: number; end: number }[] | null;
    const effectiveTutorAvail = rawTutorAvail ?? rawSchedule;
    const proposalTz = row.timezone ?? 'America/New_York';
    const durationHrs = (row.session_duration_minutes ?? 60) / 60;

    // Convert placements from the student/proposal timezone to the coordinator's timezone
    const placements = rawPlacements && coordTz !== proposalTz
      ? rawPlacements.map(pl => {
          const converted = convertTupleTimezone(
            { day: pl.day, start: pl.start, end: pl.start + durationHrs },
            proposalTz,
            coordTz,
          );
          return { day: converted.day, start: converted.start };
        })
      : rawPlacements ?? undefined;

    // Convert tutor availability ranges from proposal TZ to coordinator TZ
    const tutorAvailability = effectiveTutorAvail && coordTz !== proposalTz
      ? effectiveTutorAvail.map(r => convertTupleTimezone(
          { day: r.day, start: r.start, end: r.end },
          proposalTz,
          coordTz,
        ))
      : effectiveTutorAvail ?? undefined;

    return {
      id:            row.id,
      tutorId:       row.tutor_id ?? '',
      studentName:   row.student_name,
      subject:       row.subject,
      sentAt:        fmtRelative(row.created_at),
      sentBy:        coordName,
      status:        STATUS_MAP[row.status] ?? 'pending',
      declineReason: row.decline_reason ?? undefined,
      wasEdited:     row.status === 'PENDING' && row.resolved_at !== null,
      placements,
      tutorAvailability,
      sessionDurationMinutes: row.session_duration_minutes ?? undefined,
      sessionsPerWeek: row.sessions_per_week ?? undefined,
      tz:            coordTz,
    };
  });

  return (
    <ProposalsClient
      invitations={invitations}
      tutors={tutors}
      requests={[]}
    />
  );
}
