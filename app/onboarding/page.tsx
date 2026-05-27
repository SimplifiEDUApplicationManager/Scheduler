import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-2 p-8">
      <div className="bg-surface-1 rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <h1 className="text-2xl font-extrabold text-fg-1 mb-3">Welcome to Simplifi EDU</h1>
        <p className="text-sm text-fg-3 mb-6">
          Your account has been created. A coordinator will finish setting up your profile
          and you&apos;ll receive an email when you&apos;re ready to connect your calendar.
        </p>
        <p className="text-xs text-fg-muted">
          Signed in as <span className="font-medium text-fg-2">{user.email}</span>
        </p>
      </div>
    </div>
  );
}
