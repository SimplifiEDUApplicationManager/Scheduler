import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingClient } from '@/components/features/onboarding/OnboardingClient';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: userRow } = await supabase
    .from('users')
    .select('id, name, email, timezone, status, nylas_grant_id, nylas_scheduler_config_id')
    .eq('id', user.id)
    .single();

  if (!userRow) redirect('/login');
  if (userRow.status === 'ACTIVE') redirect('/tutor');

  // Fetch the master subjects list from the DB for the picker
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, category')
    .order('name');

  const { step: stepParam, error: oauthError } = await searchParams;
  const initialStep = stepParam ? Math.max(1, Math.min(6, parseInt(stepParam, 10))) : undefined;

  return (
    <OnboardingClient
      initialUser={{
        id:                       userRow.id,
        name:                     userRow.name,
        email:                    userRow.email,
        timezone:                 userRow.timezone ?? 'America/New_York',
        calendarConnected:        !!userRow.nylas_grant_id,
        schedulerConfigured:      !!userRow.nylas_scheduler_config_id,
      }}
      subjects={subjects ?? []}
      initialStep={initialStep}
      oauthError={oauthError}
    />
  );
}
