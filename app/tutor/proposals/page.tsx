import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TUTORS, TUTOR_PROPOSALS, TUTOR_EVENTS, ME_TUTOR_ID } from '@/lib/data/mock';
import { ProposalsClient } from '@/components/features/tutor/ProposalsClient';
import { fetchTutor } from '@/lib/data/tutors';
import { getTutorProposals } from '@/lib/data/proposals';

export default async function TutorProposalsPage() {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS === 'true') {
    const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
    if (!me) return notFound();
    return <ProposalsClient me={me} initialEvents={TUTOR_EVENTS} initialProposals={TUTOR_PROPOSALS} />;
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [me, proposals] = await Promise.all([
    fetchTutor(user.id, supabase),
    getTutorProposals(user.id, supabase),
  ]);

  if (!me) redirect('/login');

  return <ProposalsClient me={me} initialEvents={[]} initialProposals={proposals} />;
}
