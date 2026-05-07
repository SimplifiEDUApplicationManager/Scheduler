import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { TutorProposal } from '@/lib/types/domain';
import { TUTORS, TUTOR_PROPOSALS, TUTOR_EVENTS, ME_TUTOR_ID } from '@/lib/data/mock';
import { ProposalsClient } from '@/components/features/tutor/ProposalsClient';
import { fetchTutor } from '@/lib/data/tutors';

/** Format ISO date "2026-05-10" → "May 10" */
function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format timestamptz as relative time "2h ago", "1d ago", etc. */
function sentAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return `${days}d ago`;
}

export default async function TutorProposalsPage() {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS === 'true') {
    const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
    if (!me) return notFound();
    return <ProposalsClient me={me} initialEvents={TUTOR_EVENTS} initialProposals={TUTOR_PROPOSALS} />;
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [me, { data: proposalRows, error: proposalsError }] = await Promise.all([
    fetchTutor(user.id, supabase),
    supabase
      .from('proposals')
      .select('*, coordinator:users!proposals_coordinator_id_fkey(name, email)')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  if (!me) redirect('/login');
  if (proposalsError) throw proposalsError;

  const proposals: TutorProposal[] = (proposalRows ?? []).map(row => {
    const coord = row.coordinator as { name: string; email: string } | null;
    const schedule = (row.requested_schedule ?? []) as { day: number; start: number; end: number }[];
    return {
      id:               row.id,
      studentName:      row.student_name,
      studentEmail:     row.student_email,
      subject:          row.subject,
      tuples:           schedule,
      tz:               row.timezone,
      startDate:        formatDate(row.start_date),
      hoursPerWeek:     0,
      notes:            row.notes ?? '',
      coordinator:      coord?.name ?? 'Coordinator',
      coordinatorEmail: coord?.email ?? undefined,
      sentAt:           sentAgo(row.created_at),
      status:           row.status.toLowerCase() as TutorProposal['status'],
      declineReason:    row.decline_reason ?? undefined,
    };
  });

  return (
    <ProposalsClient
      me={me}
      initialEvents={[]}
      initialProposals={proposals}
    />
  );
}
