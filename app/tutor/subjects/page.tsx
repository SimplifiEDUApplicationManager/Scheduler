import { TUTORS, SUBJECTS, ME_TUTOR_ID } from '@/lib/data/dashboard-mock';
import { notFound } from 'next/navigation';
import { SubjectsClient } from '@/components/features/tutor/SubjectsClient';

export default function TutorSubjectsPage() {
  const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
  if (!me) return notFound();

  return (
    <SubjectsClient
      me={me}
      allSubjects={SUBJECTS}
    />
  );
}
