import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { TUTORS, TUTOR_PROPOSALS, TUTOR_EVENTS, ME_TUTOR_ID } from '@/lib/data/mock';
import { ProposalsClient } from '@/components/features/tutor/ProposalsClient';
import { fetchTutor } from '@/lib/data/tutors';
import { getTutorProposals } from '@/lib/data/proposals';
import { DEMO_PROPOSAL } from '@/lib/data/demo';
import { DEV_BYPASS } from '@/lib/env';

export default async function TutorProposalsPage() {
  const cookieStore = await cookies();
  // sim_tour_done is set client-side when the Danielle tour completes.
  // sim_tour_replay is set by replay() so the demo proposal re-appears even
  // if sim_tour_done is still present from a prior run.
  const tourDone   = cookieStore.get('sim_tour_done')?.value === '1';
  const tourReplay = cookieStore.get('sim_tour_replay')?.value === '1';
  const showDemo   = !tourDone || tourReplay;

  if (DEV_BYPASS) {
    const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
    if (!me) return notFound();
    const devProposals = showDemo ? [DEMO_PROPOSAL, ...TUTOR_PROPOSALS] : TUTOR_PROPOSALS;
    return <ProposalsClient me={me} initialEvents={TUTOR_EVENTS} initialProposals={devProposals} />;
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [me, proposals] = await Promise.all([
    fetchTutor(user.id, supabase),
    getTutorProposals(user.id, supabase, false),
  ]);

  if (!me) redirect('/login');

  const initialProposals = showDemo ? [DEMO_PROPOSAL, ...proposals] : proposals;

  return <ProposalsClient me={me} initialEvents={[]} initialProposals={initialProposals} />;
}
