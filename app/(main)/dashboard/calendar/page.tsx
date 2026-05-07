import { Suspense } from 'react';
import { DEV_BYPASS } from '@/lib/env';
import { TUTORS, REQUESTS } from '@/lib/data/mock';
import { createClient } from '@/lib/supabase/server';
import { fetchAllTutors } from '@/lib/data/tutors';
import { CalendarClient } from '@/components/features/calendar/CalendarClient';
import type { TuitionRequest } from '@/lib/types/domain';

export default async function CalendarPage() {
  if (DEV_BYPASS) {
    return (
      <Suspense>
        <CalendarClient tutors={TUTORS} requests={REQUESTS} />
      </Suspense>
    );
  }

  const supabase = await createClient();
  const tutors = await fetchAllTutors(supabase);
  // Requests (Asana / manual) are not yet stored in the DB.
  // The filter panel and consider-request flow will populate this once
  // the requests table is introduced. Pass empty for now so the shared
  // calendar renders with real tutor data.
  const requests: TuitionRequest[] = [];

  return (
    <Suspense>
      <CalendarClient tutors={tutors} requests={requests} />
    </Suspense>
  );
}
