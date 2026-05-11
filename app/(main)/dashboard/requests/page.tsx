import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DEV_BYPASS } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { fetchAllTutors } from '@/lib/data/tutors';
import { RequestsClient } from '@/components/features/requests/RequestsClient';
import type { TuitionRequest, RequestSource, RequestStatus, Tuple } from '@/lib/types/domain';
import type { Database } from '@/lib/types/database';

type RequestRow = Database['public']['Tables']['requests']['Row'];

function rowToRequest(row: RequestRow): TuitionRequest {
  const tuples = Array.isArray(row.requested_schedule)
    ? (row.requested_schedule as unknown as Tuple[])
    : [];

  return {
    id:           row.id,
    source:       (row.source as RequestSource) ?? 'manual',
    status:       (row.status as RequestStatus)  ?? 'open',
    studentName:  row.student_name,
    studentEmail: row.student_email,
    subject:      row.subject ?? '—',
    subjectId:    '',
    tuples,
    tz:           row.timezone ?? 'America/New_York',
    startDate:    row.start_date ?? '—',
    notes:        row.notes ?? '',
    receivedAt:   fmtRelative(row.created_at),
  };
}

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

export default async function RequestsPage() {
  if (DEV_BYPASS) {
    // In dev bypass mode we don't have a real auth session — show placeholder.
    const { REQUESTS, TUTORS, INVITATIONS } = await import('@/lib/data/mock');
    return (
      <Suspense>
        <RequestsClient
          requests={REQUESTS}
          invitations={INVITATIONS}
          tutors={TUTORS}
          hasAsana={false}
        />
      </Suspense>
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [
    { data: rows },
    { data: coordinator },
    tutors,
  ] = await Promise.all([
    supabase
      .from('requests')
      .select('*')
      .eq('coordinator_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('asana_access_token, asana_project_id')
      .eq('id', user.id)
      .single(),
    fetchAllTutors(supabase),
  ]);

  const requests = (rows ?? []).map(rowToRequest);
  const hasAsana = !!(coordinator?.asana_access_token && coordinator?.asana_project_id);

  return (
    <Suspense>
      <RequestsClient
        requests={requests}
        invitations={[]}
        tutors={tutors}
        hasAsana={hasAsana}
      />
    </Suspense>
  );
}
