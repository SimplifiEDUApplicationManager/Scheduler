import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SubjectsClient } from '@/components/features/tutor/SubjectsClient';
import type { Subject } from '@/lib/types/domain';
import { TUTORS, SUBJECTS, ME_TUTOR_ID } from '@/lib/data/mock';
import { fetchTutor } from '@/lib/data/tutors';
import { DEV_BYPASS } from '@/lib/env';

export default async function TutorSubjectsPage() {
  if (DEV_BYPASS) {
    const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
    if (!me) return notFound();
    const allSubjects: Subject[] = SUBJECTS.map(s => ({ id: s.id, name: s.name, cat: s.cat }));
    return <SubjectsClient me={me} allSubjects={allSubjects} />;
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [me, { data: subjectRows, error: subjectsError }] = await Promise.all([
    fetchTutor(user.id, supabase),
    supabase.from('subjects').select('id, name, category').order('category').order('name'),
  ]);

  if (!me) return notFound();
  if (subjectsError) throw subjectsError;

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
