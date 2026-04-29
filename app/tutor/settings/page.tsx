import { TUTORS, SUBJECTS, ME_TUTOR_ID } from '@/lib/data/dashboard-mock';
import { notFound } from 'next/navigation';
import { SettingsClient } from '@/components/features/tutor/SettingsClient';

export default function TutorSettingsPage() {
  const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
  if (!me) return notFound();

  return <SettingsClient me={me} allSubjects={SUBJECTS} />;
}
