import { TUTORS, TUTOR_EVENTS, TUTOR_PROPOSALS, ME_TUTOR_ID } from '@/lib/data/dashboard-mock';
import { notFound } from 'next/navigation';
import { TutorCalendarClient } from '@/components/features/tutor/TutorCalendarClient';

export default function TutorCalendarPage() {
  const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
  if (!me) return notFound();

  return (
    <TutorCalendarClient
      me={me}
      initialEvents={TUTOR_EVENTS}
      initialProposals={TUTOR_PROPOSALS}
    />
  );
}
