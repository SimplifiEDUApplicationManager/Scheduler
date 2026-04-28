import { Suspense } from 'react';
import { TUTORS, REQUESTS, HOLDS } from '@/lib/data/dashboard-mock';
import { CalendarClient } from '@/components/features/calendar/CalendarClient';

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarClient tutors={TUTORS} requests={REQUESTS} holds={HOLDS} />
    </Suspense>
  );
}
