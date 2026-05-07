import Link from 'next/link';
import {
  TUTORS,
  REQUESTS,
  INVITATIONS,
  AT_RISK_STUDENTS,
} from '@/lib/data/mock';
import { createClient } from '@/lib/supabase/server';
import { KpiTile } from '@/components/features/dashboard/KpiTile';
import { AlertsStrip } from '@/components/features/dashboard/AlertsStrip';
import { DashCard } from '@/components/features/dashboard/DashCard';
import { AttentionList } from '@/components/features/dashboard/AttentionList';
import { AtRiskList } from '@/components/features/dashboard/AtRiskList';
import { TeamSnapshot } from '@/components/features/dashboard/TeamSnapshot';
import { PendingReviewList } from '@/components/features/dashboard/PendingReviewList';
import type { PendingReviewItem } from '@/components/features/dashboard/PendingReviewList';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: reviewRows } = await supabase
    .from('tutor_subjects')
    .select('id, subject_id, subjects(name), users!tutor_subjects_tutor_id_fkey(name)')
    .eq('coordinator_confidence', 'UNPROVEN')
    .order('created_at');

  const pendingReviewItems: PendingReviewItem[] = (reviewRows ?? []).map(r => {
    const tutorName  = (r.users as { name: string } | null)?.name ?? 'Unknown';
    const subjectName = (r.subjects as { name: string } | null)?.name ?? '';
    return { tutorName, tutorInitials: initials(tutorName), subjectName };
  });
  const openRequests = REQUESTS.filter(r => r.status === 'open');
  const pending      = INVITATIONS.filter(i => i.status === 'pending');
  const declined     = INVITATIONS.filter(i => i.status === 'declined');
  const expired      = INVITATIONS.filter(i => i.status === 'expired');
  const accepted7d   = INVITATIONS.filter(i => i.status === 'accepted').length;

  const activeTutors = TUTORS.filter(t => t.status === 'active').length;
  const onboarding   = TUTORS.filter(t => t.status === 'onboarding').length;
  const atCap        = TUTORS.filter(t => t.hoursCurrent >= t.hoursMax).length;
  const underbooked  = TUTORS.filter(t => t.hoursCurrent < t.hoursMin).length;

  const totalCurrent = TUTORS.reduce((a, t) => a + t.hoursCurrent, 0);
  const totalMax     = TUTORS.reduce((a, t) => a + t.hoursMax, 0);
  const capacityPct  = Math.round((totalCurrent / totalMax) * 100);

  const pendingReviews = pendingReviewItems.length;

  const hasAlerts = declined.length > 0 || expired.length > 0 || pendingReviews > 0;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[1280px] mx-auto px-8 py-7 pb-16">

        {/* ── Greeting ──────────────────────────────────────────────────────── */}
        <div className="relative flex items-end justify-between gap-5 mb-7">
          {/* Brand accent circles */}
          <div
            aria-hidden
            className="absolute -left-7 -top-4 w-32 h-32 rounded-full bg-brand-cream opacity-70 pointer-events-none"
          />
          <div
            aria-hidden
            className="absolute left-[72px] top-9 w-9 h-9 rounded-full bg-brand-teal-100 opacity-90 pointer-events-none"
          />

          <div className="relative z-10">
            <h1 className="text-[38px] font-extrabold tracking-[-0.025em] leading-[1.05] mb-1 text-fg-1">
              {getGreeting()}, Meg
            </h1>
            <p className="text-sm text-fg-3">
              {openRequests.length > 0 ? (
                <>
                  You have{' '}
                  <strong className="text-fg-1">
                    {openRequests.length} open request{openRequests.length === 1 ? '' : 's'}
                  </strong>{' '}
                  waiting to be matched.
                </>
              ) : (
                'All requests are matched. Nice work.'
              )}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <Link
              href="/dashboard/requests"
              className="inline-flex items-center h-9 px-4 rounded-md border border-border-default bg-surface-1 text-fg-1 text-sm font-semibold hover:bg-surface-3 transition-colors"
            >
              View Requests
            </Link>
            <Link
              href="/dashboard/matcher"
              className="inline-flex items-center h-9 px-4 rounded-md bg-brand-ink text-fg-on-brand text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Start matching
            </Link>
          </div>
        </div>

        {/* ── KPI tiles ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <KpiTile
            label="Open requests"
            value={openRequests.length}
            hint={`${openRequests.filter(r => r.source === 'asana').length} from Asana`}
            trend={{ dir: 'up', text: '+2 since yesterday' }}
            href="/dashboard/requests"
            accentColor="var(--warning)"
          />
          <KpiTile
            label="Pending invitations"
            value={pending.length}
            hint="Awaiting tutor response"
            trend={
              pending.length > 2
                ? { dir: 'flat', text: `${pending.length} oldest > 24h`, warn: true }
                : { dir: 'flat', text: 'All recent' }
            }
            href="/dashboard/proposals"
            accentColor="var(--brand-teal-500)"
          />
          <KpiTile
            label="Tutor capacity"
            value={`${capacityPct}%`}
            hint={`${atCap} at capacity · ${underbooked} underbooked`}
            trend={{ dir: 'up', text: 'Healthy utilization' }}
            accentColor="var(--brand-ink)"
          />
          <KpiTile
            label="Sessions this week"
            value={accepted7d + 12}
            hint="Accepted & confirmed"
            trend={{ dir: 'up', text: `+${accepted7d} new bookings` }}
            accentColor="var(--brand-teal-500)"
          />
        </div>

        {/* ── Alerts strip ──────────────────────────────────────────────────── */}
        {hasAlerts && (
          <div className="mb-5">
            <AlertsStrip
              declined={declined.length}
              expired={expired.length}
              pendingReviews={pendingReviews}
            />
          </div>
        )}

        {/* ── 2×2 grid ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 items-start">
          <DashCard
            title="Needs your attention"
            subtitle="Stuck or stalled items from the last 7 days"
          >
            <AttentionList
              pending={pending}
              declined={declined}
              expired={expired}
              tutors={TUTORS}
            />
          </DashCard>

          <DashCard
            title="At-risk students"
            subtitle="Flagged by tutor check-ins or parent feedback"
            action={<span className="text-[11px] text-fg-muted">Beta · from Tutor Notes</span>}
          >
            <AtRiskList items={AT_RISK_STUDENTS} />
          </DashCard>

          <DashCard
            title="Team"
            subtitle={`${activeTutors} active · ${onboarding} onboarding`}
            action={
              <Link
                href="/dashboard/matcher"
                className="text-[11px] font-bold text-brand-primary-ink hover:text-brand-primary-deep transition-colors"
              >
                Matcher →
              </Link>
            }
          >
            <TeamSnapshot tutors={TUTORS} />
          </DashCard>

          <DashCard
            title="Subject pending review"
            subtitle="Tutors waiting on coordinator to grade"
            action={
              <Link
                href="/dashboard/subjects"
                className="text-[11px] font-bold text-brand-primary-ink hover:text-brand-primary-deep transition-colors"
              >
                Grade now →
              </Link>
            }
          >
            <PendingReviewList items={pendingReviewItems} />
          </DashCard>
        </div>

      </div>
    </div>
  );
}
