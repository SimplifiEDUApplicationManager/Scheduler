import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TUTORS, TUTOR_PROPOSALS, TUTOR_EVENTS, ME_TUTOR_ID } from '@/lib/data/mock';
import { ProposalsClient } from '@/components/features/tutor/ProposalsClient';
import { fetchTutor } from '@/lib/data/tutors';
import { getTutorProposals } from '@/lib/data/proposals';
import { DEV_BYPASS } from '@/lib/env';

export default async function TutorProposalsPage() {
  // The demo proposal (Alex Chen) is injected client-side by DanielleTour via
  // the sim:inject-demo event at the practice steps — not server-side. This
  // means a page refresh never shows a stale Alex Chen between tour steps.

  if (DEV_BYPASS) {
    const me = TUTORS.find(t => t.id === ME_TUTOR_ID);
    if (!me) return notFound();
    return <ProposalsClient me={me} initialEvents={TUTOR_EVENTS} initialProposals={TUTOR_PROPOSALS} />;
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch timezone first (lightweight) so proposals can be converted
  const { data: tzRow } = await supabase.from('users').select('timezone').eq('id', user.id).single();
  const tutorTz = tzRow?.timezone ?? undefined;

  const [me, proposals] = await Promise.all([
    fetchTutor(user.id, supabase),
    getTutorProposals(user.id, supabase, false, tutorTz),
  ]);

  if (!me) redirect('/login');

  return <ProposalsClient me={me} initialEvents={[]} initialProposals={proposals} />;
}
