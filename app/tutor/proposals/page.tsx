import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Tutor, TutorProposal, SubjectConf } from '@/lib/data/dashboard-mock';
import { ProposalsClient } from '@/components/features/tutor/ProposalsClient';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

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
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch tutor profile
  const { data: meRow, error: meError } = await supabase
    .from('users')
    .select('id, name, email, timezone, bio, max_weekly_hours, min_weekly_hours, tutor_subjects!tutor_subjects_tutor_id_fkey(subject_id, confidence, qualification_note)')
    .eq('id', user.id)
    .single();

  if (meError || !meRow) redirect('/login');

  const me: Tutor = {
    id:           meRow.id,
    initials:     initials(meRow.name),
    name:         meRow.name,
    email:        meRow.email,
    tz:           meRow.timezone ?? 'America/New_York',
    bio:          meRow.bio ?? '',
    personality:  '',
    status:       'active',
    subjects:     (meRow.tutor_subjects ?? []).map(ts => ({
      id:                ts.subject_id,
      conf:              ts.confidence as SubjectConf,
      qualificationNote: ts.qualification_note ?? undefined,
    })),
    availability: {},
    hoursCurrent: 0,
    hoursMax:     meRow.max_weekly_hours,
    hoursMin:     meRow.min_weekly_hours,
  };

  // Fetch proposals addressed to this tutor, joined with coordinator name/email
  const { data: proposalRows, error: proposalsError } = await supabase
    .from('proposals')
    .select('*, coordinator:users!proposals_coordinator_id_fkey(name, email)')
    .eq('tutor_id', user.id)
    .order('created_at', { ascending: false });

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
