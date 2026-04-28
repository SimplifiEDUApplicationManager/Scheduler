import { TUTORS, REQUESTS, INVITATIONS, SUBJECTS } from '@/lib/data/dashboard-mock';
import { RequestsClient } from '@/components/features/requests/RequestsClient';

export default function RequestsPage() {
  return (
    <RequestsClient
      requests={REQUESTS}
      invitations={INVITATIONS}
      tutors={TUTORS}
      subjects={SUBJECTS}
    />
  );
}
