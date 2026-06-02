import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingWizard } from '@/components/features/onboarding/OnboardingWizard';

export const metadata = { title: 'Get started — Simplifi EDU' };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userRow } = await supabase
    .from('users')
    .select('name, status')
    .eq('id', user.id)
    .single();

  if (!userRow) redirect('/login');
  if (userRow.status === 'ACTIVE') redirect('/tutor/settings');

  return (
    <OnboardingWizard
      initialName={userRow.name ?? ''}
      email={user.email ?? ''}
    />
  );
}
