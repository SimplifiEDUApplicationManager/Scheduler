import { createClient } from '@/lib/supabase/server';
import { TutorUpdatesClient } from '@/components/features/coordinator/TutorUpdatesClient';
import type { TutorAvailabilityActivity } from '@/lib/types/domain';
import { DEV_BYPASS } from '@/lib/env';

export interface PendingAvailabilityRequest {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorInitials: string;
  requestType: 'PAUSE' | 'LOW_MAX_HOURS' | 'LOW_AVAILABILITY_WINDOWS';
  reason: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export default async function TutorUpdatesPage() {
  if (DEV_BYPASS) {
    return <TutorUpdatesClient pendingRequests={[]} activityFeed={[]} />;
  }

  const supabase = await createClient();

  const [{ data: reqRows, error: reqErr }, { data: actRows, error: actErr }] = await Promise.all([
    supabase
      .from('tutor_availability_requests')
      .select('id, tutor_id, request_type, reason, details, status, created_at, users!tutor_availability_requests_tutor_id_fkey(name)')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true }),
    supabase
      .from('tutor_availability_activity')
      .select('id, tutor_id, event_type, summary, details, created_at, users!tutor_availability_activity_tutor_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (reqErr) throw reqErr;
  if (actErr) throw actErr;

  const pendingRequests: PendingAvailabilityRequest[] = (reqRows ?? []).map(row => {
    const tutorInfo = row.users as { name: string } | null;
    const name = tutorInfo?.name ?? 'Unknown';
    return {
      id:          row.id,
      tutorId:     row.tutor_id,
      tutorName:   name,
      tutorInitials: initials(name),
      requestType: row.request_type as PendingAvailabilityRequest['requestType'],
      reason:      row.reason,
      details:     row.details as Record<string, unknown> | null,
      createdAt:   row.created_at,
    };
  });

  const activityFeed: TutorAvailabilityActivity[] = (actRows ?? []).map(row => {
    const tutorInfo = row.users as { name: string } | null;
    const name = tutorInfo?.name ?? 'Unknown';
    return {
      id:            row.id,
      tutorId:       row.tutor_id,
      tutorName:     name,
      tutorInitials: initials(name),
      eventType:     row.event_type,
      summary:       row.summary,
      details:       (row.details as Record<string, unknown> | undefined) ?? undefined,
      createdAt:     row.created_at,
    };
  });

  return <TutorUpdatesClient pendingRequests={pendingRequests} activityFeed={activityFeed} />;
}
