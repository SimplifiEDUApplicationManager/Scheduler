import { notFound, redirect } from 'next/navigation';
import { DEV_BYPASS } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { fetchAllTutors } from '@/lib/data/tutors';
import { ConsiderRequestClient } from '@/components/features/requests/ConsiderRequestClient';
import type { TuitionRequest, RequestSource, RequestStatus, Tuple } from '@/lib/types/domain';
import type { Database } from '@/lib/types/database';

type RequestRow = Database['public']['Tables']['requests']['Row'];

function rowToRequest(
  row: RequestRow,
  subjectsByName: Map<string, string>,
): TuitionRequest {
  const tuples = Array.isArray(row.requested_schedule)
    ? (row.requested_schedule as unknown as Tuple[])
    : [];
  const subjectName = row.subject ?? '—';
  return {
    id:           row.id,
    source:       (row.source as RequestSource) ?? 'manual',
    status:       (row.status as RequestStatus)  ?? 'open',
    studentName:  row.student_name,
    studentEmail: row.student_email,
    subject:      subjectName,
    subjectId:    subjectsByName.get(subjectName.toLowerCase()) ?? '',
    tuples,
    tz:           row.timezone ?? 'America/New_York',
    startDate:    row.start_date ?? '—',
    notes:        row.notes ?? '',
    receivedAt:   '',
    asanaTaskId:  row.asana_task_id ?? undefined,
    offeredRate:  row.offered_rate ?? undefined,
    sessionDurationMinutes: row.session_duration_minutes ?? 60,
    sessionsPerWeek: row.sessions_per_week ?? 1,
  };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConsiderRequestPage({ params }: Props) {
  const { id } = await params;

  if (DEV_BYPASS) {
    const { REQUESTS, TUTORS } = await import('@/lib/data/mock');
    const request = REQUESTS.find(r => r.id === id);
    if (!request) notFound();
    return <ConsiderRequestClient request={request} tutors={TUTORS} coordinatorTz="America/New_York" />;
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [{ data: row }, tutors, { data: subjects }, { data: coordRow }] = await Promise.all([
    supabase.from('requests').select('*').eq('id', id).eq('coordinator_id', user.id).single(),
    fetchAllTutors(supabase),
    supabase.from('subjects').select('id, name'),
    supabase.from('users').select('timezone').eq('id', user.id).single(),
  ]);

  if (!row) notFound();

  const subjectsByName = new Map(
    (subjects ?? []).map(s => [s.name.toLowerCase(), s.id]),
  );
  const coordinatorTz = coordRow?.timezone ?? 'America/New_York';

  return (
    <ConsiderRequestClient
      request={rowToRequest(row, subjectsByName)}
      tutors={tutors}
      coordinatorTz={coordinatorTz}
    />
  );
}
