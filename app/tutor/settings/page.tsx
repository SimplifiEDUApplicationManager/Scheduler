import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from '@/components/features/tutor/SettingsClient';
import type { Subject } from '@/lib/types/domain';
import { TUTORS, SUBJECTS, ME_TUTOR_ID } from '@/lib/data/mock';
import { fetchTutor } from '@/lib/data/tutors';
import { fetchSchedulerSummary, type SchedulerSummary } from '@/lib/nylas/scheduler';
import { DEV_BYPASS } from '@/lib/env';

export default async function TutorSettingsPage() {
  if (DEV_BYPASS) {
    const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
    if (!me) return notFound();
    const allSubjects: Subject[] = SUBJECTS.map(s => ({ id: s.id, name: s.name, cat: s.cat, level: s.level }));
    return <Suspense><SettingsClient me={me} allSubjects={allSubjects} schedulerSummary={null} /></Suspense>;
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [me, { data: subjectRows, error: subjectsError }] = await Promise.all([
    fetchTutor(user.id, supabase),
    supabase.from('subjects').select('id, name, category, level').order('category').order('name'),
  ]);

  if (!me) return notFound();
  if (subjectsError) throw subjectsError;

  const allSubjects: Subject[] = (subjectRows ?? []).map(s => ({
    id:    s.id,
    name:  s.name,
    cat:   s.category,
    level: (s.level ?? 'High School') as Subject['level'],
  }));

  // Fetch the Nylas Scheduler config for the read-only summary card.
  // If the tutor hasn't linked a config yet, pass null — the card shows a prompt.
  const schedulerSummary: SchedulerSummary | null =
    me.nylasSchedulerConfigId && me.nylasGrantId
      ? await fetchSchedulerSummary(me.nylasSchedulerConfigId, me.nylasGrantId)
      : null;

  return (
    <Suspense>
      <SettingsClient me={me} allSubjects={allSubjects} schedulerSummary={schedulerSummary} />
    </Suspense>
  );
}
