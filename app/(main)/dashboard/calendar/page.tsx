import { Suspense } from 'react';
import { TUTORS, REQUESTS, SUBJECTS, HOLDS } from '@/lib/data/dashboard-mock';
import { CalendarClient } from '@/components/features/calendar/CalendarClient';

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarClient
        tutors={TUTORS}
        requests={REQUESTS}
        subjects={SUBJECTS}
        holds={HOLDS}
      />
    </Suspense>
  );
}
