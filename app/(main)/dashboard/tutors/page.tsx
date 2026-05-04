import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { REQUESTS, HOLDS, INVITATIONS } from '@/lib/data/dashboard-mock';
import type { Tutor, Subject, SubjectConf } from '@/lib/data/dashboard-mock';
import { TutorsClient } from '@/components/features/tutors/TutorsClient';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export default async function TutorsPage() {
  const supabase = await createClient();

  const [
    { data: userRows,    error: usersError    },
    { data: subjectRows, error: subjectsError },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, timezone, bio, max_weekly_hours, min_weekly_hours, tutor_subjects!tutor_subjects_tutor_id_fkey(subject_id, confidence, qualification_note)')
      .eq('role', 'TUTOR')
      .eq('status', 'ACTIVE')
      .order('name'),
    supabase
      .from('subjects')
      .select('id, name, category')
      .order('name'),
  ]);

  if (usersError)    throw usersError;
  if (subjectsError) throw subjectsError;

  const tutors: Tutor[] = (userRows ?? []).map(row => ({
    id:           row.id,
    initials:     initials(row.name),
    name:         row.name,
    email:        row.email,
    tz:           row.timezone ?? 'America/New_York',
    bio:          row.bio ?? '',
    personality:  '',
    status:       'active' as const,
    subjects:     (row.tutor_subjects ?? []).map(ts => ({
      id:                ts.subject_id,
      conf:              ts.confidence as SubjectConf,
      qualificationNote: ts.qualification_note ?? undefined,
    })),
    availability: {},
    hoursCurrent: 0,
    hoursMax:     row.max_weekly_hours,
    hoursMin:     row.min_weekly_hours,
  }));

  const subjects: Subject[] = (subjectRows ?? []).map(s => ({
    id:   s.id,
    name: s.name,
    cat:  s.category,
  }));

  return (
    <Suspense>
      <TutorsClient
        tutors={tutors}
        requests={REQUESTS}
        subjects={subjects}
        holds={HOLDS}
        invitations={INVITATIONS}
      />
    </Suspense>
  );
}
