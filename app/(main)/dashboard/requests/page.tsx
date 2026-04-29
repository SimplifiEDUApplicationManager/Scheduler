import { Suspense } from 'react';
import { TUTORS, REQUESTS, INVITATIONS } from '@/lib/data/dashboard-mock';
import { RequestsClient } from '@/components/features/requests/RequestsClient';

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestsClient
        requests={REQUESTS}
        invitations={INVITATIONS}
        tutors={TUTORS}
      />
    </Suspense>
  );
}
