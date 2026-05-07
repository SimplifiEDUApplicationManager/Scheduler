// Tutor repository — single source of truth for fetching Tutor domain objects from Supabase.
// All pages that need a Tutor or Tutor[] call these functions instead of writing inline queries.
//
// Design decisions:
//   - Caller creates and passes the Supabase client (anon or service-role, caller's choice).
//   - Always fetches all columns so pages don't need partial variants.
//   - Returns null / empty array on not-found; callers decide whether to notFound() or redirect().

import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';
import type { Tutor, TutorSubject, SubjectConf, CoordConf } from '@/lib/types/domain';

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
  tutor_subjects: {
    id: string;
    subject_id: string;
    tutor_confidence: string;
    coordinator_confidence: string;
    qualification_note: string | null;
  }[] | null;
};

function rowToTutor(row: RawTutorRow): Tutor {
  const subjects: TutorSubject[] = (row.tutor_subjects ?? []).map(ts => ({
    id:                ts.subject_id,
    rowId:             ts.id,
    conf:              ts.tutor_confidence as SubjectConf,
    coordConf:         ts.coordinator_confidence as CoordConf,
    qualificationNote: ts.qualification_note ?? undefined,
  }));

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
  };
}

/** Fetch a single tutor by their user ID. Returns null if not found or on error. */
export async function fetchTutor(
  userId: string,
  supabase: SupabaseInstance,
): Promise<Tutor | null> {
  const { data, error } = await supabase
    .from('users')
    .select(SELECT_TUTOR)
    .eq('id', userId)
    .eq('role', 'TUTOR')
    .single();

  if (error || !data) return null;
  return rowToTutor(data as unknown as RawTutorRow);
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
  return (data ?? []).map(row => rowToTutor(row as unknown as RawTutorRow));
}
