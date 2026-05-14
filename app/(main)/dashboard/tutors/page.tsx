import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { INVITATIONS } from '@/lib/data/mock';
import type { Subject, TuitionRequest, RequestSource, RequestStatus, Tuple } from '@/lib/types/domain';
import type { Database } from '@/lib/types/database';
import { TutorsClient } from '@/components/features/tutors/TutorsClient';
import { fetchAllTutors } from '@/lib/data/tutors';

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
    status:       (row.status as RequestStatus) ?? 'open',
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
  };
}

export default async function TutorsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [tutors, { data: subjectRows, error: subjectsError }, { data: requestRows }, { data: coordRow }] = await Promise.all([
    fetchAllTutors(supabase),
    supabase.from('subjects').select('id, name, category').order('name'),
    supabase.from('requests').select('*').eq('coordinator_id', user.id).eq('status', 'open').order('created_at', { ascending: false }),
    supabase.from('users').select('timezone').eq('id', user.id).single(),
  ]);

  if (subjectsError) throw subjectsError;

  const subjects: Subject[] = (subjectRows ?? []).map(s => ({
    id:   s.id,
    name: s.name,
    cat:  s.category,
  }));

  const subjectsByName = new Map(
    (subjectRows ?? []).map(s => [s.name.toLowerCase(), s.id]),
  );

  const requests = (requestRows ?? []).map(r => rowToRequest(r, subjectsByName));
  const coordinatorTz = coordRow?.timezone ?? 'America/New_York';

  return (
    <Suspense>
      <TutorsClient
        tutors={tutors}
        requests={requests}
        subjects={subjects}
        invitations={INVITATIONS}
        coordinatorTz={coordinatorTz}
      />
    </Suspense>
  );
}
