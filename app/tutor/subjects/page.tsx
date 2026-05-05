import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SubjectsClient } from '@/components/features/tutor/SubjectsClient';
import type { Tutor, Subject, SubjectConf } from '@/lib/data/dashboard-mock';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export default async function TutorSubjectsPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [
    { data: meRow, error: meError },
    { data: subjectRows, error: subjectsError },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, timezone, bio, max_weekly_hours, min_weekly_hours, tutor_subjects!tutor_subjects_tutor_id_fkey(id, subject_id, confidence, qualification_note)')
      .eq('id', user.id)
      .single(),
    supabase
      .from('subjects')
      .select('id, name, category')
      .order('category')
      .order('name'),
  ]);

  if (meError || !meRow) return notFound();
  if (subjectsError) throw subjectsError;

  const me: Tutor = {
    id:           meRow.id,
    initials:     initials(meRow.name),
    name:         meRow.name,
    email:        meRow.email,
    tz:           meRow.timezone ?? 'America/New_York',
    bio:          meRow.bio ?? '',
    personality:  '',
    status:       'active' as const,
    subjects:     (meRow.tutor_subjects ?? []).map(ts => ({
      id:                ts.subject_id,
      rowId:             ts.id,
      conf:              ts.confidence as SubjectConf,
      qualificationNote: ts.qualification_note ?? undefined,
    })),
    availability: {},
    hoursCurrent: 0,
    hoursMax:     meRow.max_weekly_hours,
    hoursMin:     meRow.min_weekly_hours,
  };

  const allSubjects: Subject[] = (subjectRows ?? []).map(s => ({
    id:   s.id,
    name: s.name,
    cat:  s.category,
  }));

  return (
    <SubjectsClient
      me={me}
      allSubjects={allSubjects}
    />
  );
}
