import { Suspense } from 'react';
import { TUTORS, REQUESTS, SUBJECTS, HOLDS, INVITATIONS } from '@/lib/data/dashboard-mock';
import { TutorsClient } from '@/components/features/tutors/TutorsClient';

export default function TutorsPage() {
  return (
    <Suspense>
      <TutorsClient tutors={TUTORS} requests={REQUESTS} subjects={SUBJECTS} holds={HOLDS} invitations={INVITATIONS} />
    </Suspense>
  );
}
