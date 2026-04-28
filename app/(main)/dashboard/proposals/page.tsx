import { INVITATIONS, TUTORS, REQUESTS } from '@/lib/data/dashboard-mock';
import { ProposalsClient } from '@/components/features/proposals/ProposalsClient';

export default function ProposalsPage() {
  return (
    <ProposalsClient
      invitations={INVITATIONS}
      tutors={TUTORS}
      requests={REQUESTS}
    />
  );
}
