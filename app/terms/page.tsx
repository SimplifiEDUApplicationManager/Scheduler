import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of Service — Simplifi EDU' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-[720px] mx-auto px-6 py-16">
        <Link href="/" className="text-[15px] font-extrabold text-fg-1 tracking-tight hover:opacity-80 transition-opacity">
          Simplifi EDU
        </Link>

        <h1 className="text-[32px] font-extrabold text-fg-1 tracking-[-0.02em] mt-8 mb-2">Terms of Service</h1>
        <p className="text-sm text-fg-3 mb-10">Last updated: July 6, 2026</p>

        <div className="bg-surface-1 border border-border-default rounded-2xl p-8 space-y-8">
          <Section title="Agreement">
            <p>
              By accessing or using the Simplifi EDU tutor scheduling platform (&quot;the Service&quot;), you agree to these terms. If you do not agree, do not use the Service.
            </p>
          </Section>

          <Section title="Description of Service">
            <p>
              Simplifi EDU provides a scheduling platform that connects tutors with students through coordinators. The Service includes calendar integration, availability management, proposal matching, and session scheduling.
            </p>
          </Section>

          <Section title="Accounts">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must be invited by a coordinator or administrator to create an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must provide accurate information when setting up your profile.</li>
              <li>You may not share your account with others or use another person&apos;s account.</li>
            </ul>
          </Section>

          <Section title="Calendar integration">
            <p>
              The Service integrates with your Google or Microsoft calendar to check availability and create tutoring session events. By connecting your calendar, you authorize us to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Read your calendar events to determine when you are busy or free.</li>
              <li>Create, modify, and delete tutoring session events on your calendar.</li>
            </ul>
            <p className="mt-2">
              You can disconnect your calendar at any time from your Settings page. Disconnecting stops all calendar access immediately.
            </p>
          </Section>

          <Section title="Tutor responsibilities">
            <p>As a tutor on the platform, you agree to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Respond to proposals within 24 hours (unresponded proposals expire automatically).</li>
              <li>Keep your availability and working hours up to date.</li>
              <li>Honor sessions you have accepted, or communicate cancellations promptly.</li>
              <li>Maintain professional conduct in all interactions with students and coordinators.</li>
            </ul>
          </Section>

          <Section title="Coordinator responsibilities">
            <p>As a coordinator, you agree to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Use tutor data only for the purpose of matching students with appropriate tutors.</li>
              <li>Not share tutor contact information outside the platform without consent.</li>
              <li>Accurately represent student needs and scheduling requirements.</li>
            </ul>
          </Section>

          <Section title="Acceptable use">
            <p>You may not:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Use the Service for any unlawful purpose.</li>
              <li>Attempt to access other users&apos; accounts or data.</li>
              <li>Interfere with or disrupt the Service.</li>
              <li>Scrape, copy, or extract data from the platform programmatically without authorization.</li>
            </ul>
          </Section>

          <Section title="Intellectual property">
            <p>
              The Service, including its design, features, and content, is owned by Simplifi EDU. You retain ownership of any content you provide (profile information, notes, etc.).
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. Simplifi EDU is not liable for any indirect, incidental, or consequential damages arising from your use of the Service, including but not limited to missed sessions, scheduling errors, or calendar sync issues.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              We may suspend or terminate your account if you violate these terms. You may request account deletion at any time by contacting us. Upon termination, your calendar connection is immediately revoked and your data is deleted within 30 days.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              Questions about these terms? Contact us at{' '}
              <a href="mailto:austin@simplifiedu.com" className="text-brand-primary-ink underline">austin@simplifiedu.com</a>.
            </p>
          </Section>
        </div>

        <div className="mt-8 text-center text-xs text-fg-muted">
          <Link href="/privacy" className="hover:text-fg-2 transition-colors">Privacy Policy</Link>
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
