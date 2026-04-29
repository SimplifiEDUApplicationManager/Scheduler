import { TUTORS, TUTOR_EVENTS, TUTOR_PROPOSALS, ME_TUTOR_ID } from '@/lib/data/dashboard-mock';
import { notFound } from 'next/navigation';
import { ProposalsClient } from '@/components/features/tutor/ProposalsClient';

export default function TutorProposalsPage() {
  const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
  if (!me) return notFound();

  return (
    <ProposalsClient
      me={me}
      initialEvents={TUTOR_EVENTS}
      initialProposals={TUTOR_PROPOSALS}
    />
  );
}
