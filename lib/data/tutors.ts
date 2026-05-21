// Tutor repository — single source of truth for fetching Tutor domain objects from Supabase.
// All pages that need a Tutor or Tutor[] call these functions instead of writing inline queries.
//
// Design decisions:
//   - Caller creates and passes the Supabase client (anon or service-role, caller's choice).
//   - Always fetches all columns so pages don't need partial variants.
//   - Returns null / empty array on not-found; callers decide whether to notFound() or redirect().

import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';
import type { Tutor, TutorSubject, TutorSubjectChange, TutorAvailabilityRequest, SubjectConf, CoordConf, SubjectChangeType, SubjectChangeStatus, AvailabilityRequestType, AvailabilityRequestStatus } from '@/lib/types/domain';

type SupabaseInstance = ReturnType<typeof createServerClient<Database>>;

const SELECT_TUTOR = [
  'id',
  'name',
  'email',
  'timezone',
  'bio',
  'max_weekly_hours',
  'min_weekly_hours',
  'meeting_link',
  'booking_page_url',
  'nylas_scheduler_config_id',
  'nylas_grant_id',
  'photo_url',
  'is_paused',
  'total_availability_hours',
  'tutor_subjects!tutor_subjects_tutor_id_fkey(id, subject_id, tutor_confidence, coordinator_confidence, qualification_note)',
].join(', ');

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

type RawTutorRow = {
  id: string;
  name: string;
  email: string;
  timezone: string | null;
  bio: string | null;
  max_weekly_hours: number;
  min_weekly_hours: number;
  meeting_link: string | null;
  booking_page_url: string | null;
  nylas_scheduler_config_id: string | null;
  nylas_grant_id: string | null;
  photo_url: string | null;
  is_paused: boolean;
  total_availability_hours: number;
  tutor_subjects: {
    id: string;
    subject_id: string;
    tutor_confidence: string;
    coordinator_confidence: string;
    qualification_note: string | null;
  }[] | null;
};

type RawAvailabilityRequestRow = {
  id: string;
  tutor_id: string;
  request_type: string;
  reason: string;
  details: Record<string, unknown> | null;
  status: string;
  decline_reason: string | null;
  created_at: string;
};

function rowToAvailabilityRequest(row: RawAvailabilityRequestRow): TutorAvailabilityRequest {
  return {
    id:          row.id,
    tutorId:     row.tutor_id,
    requestType: row.request_type as AvailabilityRequestType,
    reason:      row.reason,
    details:     row.details ?? undefined,
    status:      row.status as AvailabilityRequestStatus,
    declineReason: row.decline_reason ?? undefined,
    createdAt:   row.created_at,
  };
}

type RawChangeRow = {
  id: string;
  tutor_id: string;
  subject_id: string;
  tutor_subject_id: string | null;
  change_type: string;
  requested_confidence: string | null;
  requested_note: string | null;
  status: string;
  decline_reason: string | null;
  created_at: string;
};

function rowToChange(row: RawChangeRow): TutorSubjectChange {
  return {
    id:              row.id,
    tutorId:         row.tutor_id,
    subjectId:       row.subject_id,
    tutorSubjectId:  row.tutor_subject_id ?? undefined,
    changeType:      row.change_type as SubjectChangeType,
    requestedConf:   row.requested_confidence ? (row.requested_confidence as SubjectConf) : undefined,
    requestedNote:   row.requested_note ?? undefined,
    status:          row.status as SubjectChangeStatus,
    declineReason:   row.decline_reason ?? undefined,
    createdAt:       row.created_at,
  };
}

function rowToTutor(row: RawTutorRow, pendingChanges: RawChangeRow[], availabilityRequests: RawAvailabilityRequestRow[]): Tutor {
  // Build a map of subjectId → pending change for quick lookup
  const changeBySubjectId = new Map<string, TutorSubjectChange>();
  for (const c of pendingChanges) {
    changeBySubjectId.set(c.subject_id, rowToChange(c));
  }

  const subjects: TutorSubject[] = (row.tutor_subjects ?? []).map(ts => ({
    id:                ts.subject_id,
    rowId:             ts.id,
    conf:              ts.tutor_confidence as SubjectConf,
    coordConf:         ts.coordinator_confidence as CoordConf,
    qualificationNote: ts.qualification_note ?? undefined,
    pendingChange:     changeBySubjectId.get(ts.subject_id),
  }));

  // Append pending ADD changes as subjects that don't have an approved row yet
  for (const c of pendingChanges) {
    if (c.change_type === 'ADD' && !subjects.some(s => s.id === c.subject_id)) {
      subjects.push({
        id:            c.subject_id,
        conf:          (c.requested_confidence as SubjectConf) ?? 'MEDIUM',
        pendingChange: rowToChange(c),
      });
    }
  }

  return {
    id:                     row.id,
    initials:               initials(row.name),
    name:                   row.name,
    email:                  row.email,
    tz:                     row.timezone ?? 'America/New_York',
    bio:                    row.bio ?? '',
    personality:            '',
    status:                 'active',
    subjects,
    availability:           {},
    hoursCurrent:           0,
    hoursMax:               row.max_weekly_hours,
    hoursMin:               row.min_weekly_hours,
    meetingLink:            row.meeting_link ?? undefined,
    bookingPageUrl:         row.booking_page_url ?? undefined,
    nylasSchedulerConfigId: row.nylas_scheduler_config_id ?? undefined,
    nylasGrantId:           row.nylas_grant_id ?? undefined,
    photoUrl:               row.photo_url ?? undefined,
    isPaused:               row.is_paused ?? false,
    totalAvailabilityHours: Number(row.total_availability_hours ?? 0),
    availabilityRequests:   availabilityRequests.map(rowToAvailabilityRequest),
  };
}

/** Fetch a single tutor by their user ID, including pending subject changes and availability requests. */
export async function fetchTutor(
  userId: string,
  supabase: SupabaseInstance,
): Promise<Tutor | null> {
  const [tutorResult, changesResult, availReqResult] = await Promise.all([
    supabase
      .from('users')
      .select(SELECT_TUTOR)
      .eq('id', userId)
      .eq('role', 'TUTOR')
      .single(),
    supabase
      .from('tutor_subject_changes')
      .select('id, tutor_id, subject_id, tutor_subject_id, change_type, requested_confidence, requested_note, status, decline_reason, created_at')
      .eq('tutor_id', userId)
      .eq('status', 'PENDING'),
    supabase
      .from('tutor_availability_requests')
      .select('id, tutor_id, request_type, reason, details, status, decline_reason, created_at')
      .eq('tutor_id', userId)
      .in('status', ['PENDING', 'DECLINED'])
      .order('created_at', { ascending: false }),
  ]);

  if (tutorResult.error || !tutorResult.data) return null;

  const pendingChanges     = (changesResult.data ?? []) as RawChangeRow[];
  const availabilityReqs   = (availReqResult.data ?? []) as RawAvailabilityRequestRow[];

  // Keep only: all PENDING, plus the most recent DECLINED per type (for showing declined state in UI).
  const seenDeclinedTypes = new Set<string>();
  const filteredReqs = availabilityReqs.filter(r => {
    if (r.status === 'PENDING') return true;
    if (!seenDeclinedTypes.has(r.request_type)) {
      seenDeclinedTypes.add(r.request_type);
      return true;
    }
    return false;
  });

  return rowToTutor(tutorResult.data as unknown as RawTutorRow, pendingChanges, filteredReqs);
}

/** Fetch all active tutors, ordered by name. */
export async function fetchAllTutors(supabase: SupabaseInstance): Promise<Tutor[]> {
  const { data, error } = await supabase
    .from('users')
    .select(SELECT_TUTOR)
    .eq('role', 'TUTOR')
    .eq('status', 'ACTIVE')
    .order('name');

  if (error) throw error;
  // fetchAllTutors is for coordinator views — no pending changes or requests needed
  return (data ?? []).map(row => rowToTutor(row as unknown as RawTutorRow, [], []));
}
