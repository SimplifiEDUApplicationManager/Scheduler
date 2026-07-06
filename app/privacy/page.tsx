import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy Policy — Simplifi EDU' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-[720px] mx-auto px-6 py-16">
        <Link href="/" className="text-[15px] font-extrabold text-fg-1 tracking-tight hover:opacity-80 transition-opacity">
          Simplifi EDU
        </Link>

        <h1 className="text-[32px] font-extrabold text-fg-1 tracking-[-0.02em] mt-8 mb-2">Privacy Policy</h1>
        <p className="text-sm text-fg-3 mb-10">Last updated: July 6, 2026</p>

        <div className="bg-surface-1 border border-border-default rounded-2xl p-8 space-y-8">
          <Section title="Overview">
            <p>
              Simplifi EDU (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Simplifi EDU tutor scheduling platform. This policy explains what information we collect, how we use it, and your choices regarding your data.
            </p>
          </Section>

          <Section title="Information we collect">
            <p>When you create an account or use our platform, we may collect:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><b>Account information</b> — your name, email address, and profile photo.</li>
              <li><b>Calendar data</b> — we connect to your Google or Microsoft calendar via Nylas to read your availability (busy/free times) and create tutoring session events. We do not read email content or contacts.</li>
              <li><b>Scheduling preferences</b> — your working hours, session availability, timezone, and any exceptions you set.</li>
              <li><b>Tutoring activity</b> — proposals sent and received, sessions booked, subjects taught, and response times.</li>
            </ul>
          </Section>

          <Section title="How we use your information">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To display your availability to coordinators so they can match you with students.</li>
              <li>To create and manage tutoring session calendar events on your behalf.</li>
              <li>To compute your weekly capacity and response time ranking.</li>
              <li>To send you notifications about new proposals and schedule changes.</li>
              <li>To improve the platform and resolve issues.</li>
            </ul>
          </Section>

          <Section title="Calendar access">
            <p>
              We request read and write access to your calendar solely to check your availability and create tutoring session events. We use <a href="https://www.nylas.com" target="_blank" rel="noreferrer" className="text-brand-primary-ink underline">Nylas</a> as our calendar integration provider. We do not:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Read your email or contacts.</li>
              <li>Access calendars other than the one you connect.</li>
              <li>Share your calendar data with third parties for advertising.</li>
            </ul>
          </Section>

          <Section title="Data sharing">
            <p>
              We do not sell your personal information. We share data only with:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><b>Nylas</b> — our calendar integration provider, to sync your calendar.</li>
              <li><b>Supabase</b> — our database provider, to store your account and scheduling data.</li>
              <li><b>Vercel</b> — our hosting provider, to serve the application.</li>
              <li><b>Coordinators</b> — your name, availability, subjects, and capacity are visible to Simplifi EDU coordinators for the purpose of matching you with students.</li>
            </ul>
          </Section>

          <Section title="Data retention">
            <p>
              We retain your data for as long as your account is active. If you request account deletion, we will remove your personal data within 30 days. Calendar connections can be disconnected at any time from your Settings page, which immediately stops calendar syncing.
            </p>
          </Section>

          <Section title="Your rights">
            <p>You can:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Access, update, or delete your profile information from your Settings page.</li>
              <li>Disconnect your calendar at any time.</li>
              <li>Request a copy of your data or full account deletion by emailing us.</li>
            </ul>
          </Section>

          <Section title="Security">
            <p>
              We use industry-standard security practices including encrypted connections (HTTPS), secure authentication, and access controls. Calendar tokens are stored encrypted and are never exposed to other users.
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              If you have questions about this privacy policy or your data, contact us at{' '}
              <a href="mailto:austin@simplifiedu.com" className="text-brand-primary-ink underline">austin@simplifiedu.com</a>.
            </p>
          </Section>
        </div>

        <div className="mt-8 text-center text-xs text-fg-muted">
          <Link href="/terms" className="hover:text-fg-2 transition-colors">Terms of Service</Link>
          <span className="mx-2">·</span>
          <Link href="/" className="hover:text-fg-2 transition-colors">Back to Simplifi EDU</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[15px] font-bold text-fg-1 mb-2">{title}</h2>
      <div className="text-[13px] text-fg-2 leading-relaxed">{children}</div>
    </div>
  );
}
