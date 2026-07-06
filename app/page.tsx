import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DEV_BYPASS } from '@/lib/env';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  if (DEV_BYPASS) {
    redirect('/dashboard');
  }

  // If Supabase lands a magic-link code at the root URL, forward it.
  const { code } = await searchParams;
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  // If logged in, redirect to the appropriate dashboard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userRow?.role === 'TUTOR') redirect('/tutor/calendar');
    if (userRow) redirect('/dashboard');
  }

  // Public landing page for unauthenticated visitors + Google verification
  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 flex items-center justify-between">
        <span className="text-[17px] font-extrabold text-fg-1 tracking-tight">Simplifi EDU</span>
        <Link
          href="/login"
          className="h-9 px-5 rounded-lg bg-brand-ink text-white text-[13px] font-semibold inline-flex items-center hover:bg-neutral-700 transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-[560px] text-center">
          <h1 className="text-[42px] font-extrabold text-fg-1 tracking-[-0.03em] leading-[1.1] mb-4">
            Tutor scheduling,<br />simplified.
          </h1>
          <p className="text-[16px] text-fg-2 leading-relaxed mb-8">
            Simplifi EDU connects coordinators with tutors through intelligent matching, real-time calendar availability, and streamlined proposal management — so every student gets paired with the right tutor, fast.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="h-11 px-6 rounded-xl bg-brand-ink text-white text-[14px] font-semibold inline-flex items-center hover:bg-neutral-700 transition-colors"
            >
              Sign in to your account
            </Link>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-[720px] mt-16">
          <FeatureCard
            title="Smart matching"
            body="Filter tutors by subject, availability, and capacity. Send proposals with one click."
          />
          <FeatureCard
            title="Calendar sync"
            body="Connect Google or Outlook calendars. Real-time availability — no double bookings."
          />
          <FeatureCard
            title="Built for tutors"
            body="Accept proposals, drag sessions onto your calendar, and track your response time ranking."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 text-center text-xs text-fg-muted">
        <Link href="/privacy" className="hover:text-fg-2 transition-colors">Privacy Policy</Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:text-fg-2 transition-colors">Terms of Service</Link>
        <span className="mx-2">·</span>
        <span>Simplifi EDU</span>
      </footer>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-surface-1 border border-border-default rounded-xl p-5">
      <h3 className="text-[13px] font-bold text-fg-1 mb-1.5">{title}</h3>
      <p className="text-[12px] text-fg-3 leading-relaxed">{body}</p>
    </div>
  );
}
