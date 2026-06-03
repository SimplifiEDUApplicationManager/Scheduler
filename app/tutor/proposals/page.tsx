import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TUTORS, TUTOR_PROPOSALS, TUTOR_EVENTS, ME_TUTOR_ID } from '@/lib/data/mock';
import { ProposalsClient } from '@/components/features/tutor/ProposalsClient';
import { fetchTutor } from '@/lib/data/tutors';
import { getTutorProposals } from '@/lib/data/proposals';
import { DEMO_PROPOSAL } from '@/lib/data/demo';
import { DEV_BYPASS } from '@/lib/env';

export default async function TutorProposalsPage() {
  if (DEV_BYPASS) {
    const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
    if (!me) return notFound();
    return <ProposalsClient me={me} initialEvents={TUTOR_EVENTS} initialProposals={[DEMO_PROPOSAL, ...TUTOR_PROPOSALS]} />;
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [me, proposals] = await Promise.all([
    fetchTutor(user.id, supabase),
    getTutorProposals(user.id, supabase, false),
  ]);

  if (!me) redirect('/login');

  return <ProposalsClient me={me} initialEvents={[]} initialProposals={[DEMO_PROPOSAL, ...proposals]} />;
}
