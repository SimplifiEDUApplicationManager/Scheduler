import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { REQUESTS, INVITATIONS } from '@/lib/data/mock';
import type { Subject } from '@/lib/types/domain';
import { TutorsClient } from '@/components/features/tutors/TutorsClient';
import { fetchAllTutors } from '@/lib/data/tutors';

export default async function TutorsPage() {
  const supabase = await createClient();

  const [tutors, { data: subjectRows, error: subjectsError }] = await Promise.all([
    fetchAllTutors(supabase),
    supabase.from('subjects').select('id, name, category').order('name'),
  ]);

  if (subjectsError) throw subjectsError;

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
        invitations={INVITATIONS}
      />
    </Suspense>
  );
}
