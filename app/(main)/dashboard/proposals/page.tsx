import { redirect } from 'next/navigation';
import { DEV_BYPASS } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { fetchAllTutors } from '@/lib/data/tutors';
import { ProposalsClient } from '@/components/features/proposals/ProposalsClient';
import type { Invitation, InvitationStatus } from '@/lib/types/domain';

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
  PENDING:  'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED:  'expired',
  FINISHED: 'finished',
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
      .select('id, tutor_id, student_name, subject, status, decline_reason, created_at')
      .eq('coordinator_id', user.id)
      .order('created_at', { ascending: false }),
    fetchAllTutors(supabase),
    supabase.from('users').select('name').eq('id', user.id).single(),
  ]);

  const coordName = coordRow?.name ?? 'Coordinator';

  const invitations: Invitation[] = (rows ?? []).map(row => ({
    id:            row.id,
    tutorId:       row.tutor_id ?? '',
    studentName:   row.student_name,
    subject:       row.subject,
    sentAt:        fmtRelative(row.created_at),
    sentBy:        coordName,
    status:        STATUS_MAP[row.status] ?? 'pending',
    declineReason: row.decline_reason ?? undefined,
  }));

  return (
    <ProposalsClient
      invitations={invitations}
      tutors={tutors}
      requests={[]}
    />
  );
}
