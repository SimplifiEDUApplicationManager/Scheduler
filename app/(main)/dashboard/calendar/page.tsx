import { Suspense } from 'react';
import { TUTORS, REQUESTS } from '@/lib/data/mock';
import { CalendarClient } from '@/components/features/calendar/CalendarClient';

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarClient tutors={TUTORS} requests={REQUESTS} />
    </Suspense>
  );
}
