import Link from 'next/link';
import {
  INVITATIONS,
} from '@/lib/data/mock';
import { fetchAllTutors } from '@/lib/data/tutors';
import { createClient } from '@/lib/supabase/server';
import { KpiTile } from '@/components/features/dashboard/KpiTile';
import { AlertsStrip } from '@/components/features/dashboard/AlertsStrip';
import { DashCard } from '@/components/features/dashboard/DashCard';
import { StalledRequestList } from '@/components/features/dashboard/StalledRequestList';
import type { StalledRequest } from '@/components/features/dashboard/StalledRequestList';
import { TeamSnapshot } from '@/components/features/dashboard/TeamSnapshot';
import { PendingReviewList } from '@/components/features/dashboard/PendingReviewList';
import type { PendingReviewItem } from '@/components/features/dashboard/PendingReviewList';
import { PendingAvailabilityList } from '@/components/features/dashboard/PendingAvailabilityList';
import type { PendingAvailabilityItem } from '@/components/features/dashboard/PendingAvailabilityList';
import { ResponseTimeLeaderboard } from '@/components/features/dashboard/ResponseTimeLeaderboard';
import type { LeaderboardRow } from '@/components/features/dashboard/ResponseTimeLeaderboard';
import { computeLeaderboard } from '@/lib/utils/responseTime';

function getGreeting(tz?: string | null): string {
  const h = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz ?? 'UTC' })
      .format(new Date()),
    10,
  );
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

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userRow } = authUser
    ? await supabase.from('users').select('name, timezone').eq('id', authUser.id).single()
    : { data: null };
  const firstName = userRow?.name?.split(' ')[0] ?? 'there';
  const userTz = userRow?.timezone;

  const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: reviewRows }, { data: availRows }, { data: resolvedProposals }, { data: openRequestRows }, { count: onboardingCount }, realTutors] = await Promise.all([
    supabase
      .from('tutor_subject_changes')
      .select('id, subjects!tutor_subject_changes_subject_id_fkey(name), users!tutor_subject_changes_tutor_id_fkey(name)')
      .eq('status', 'PENDING')
      .order('created_at'),
    supabase
      .from('tutor_availability_requests')
      .select('id, tutor_id, request_type, reason')
      .eq('status', 'PENDING')
      .order('created_at'),
    supabase
      .from('proposals')
      .select('tutor_id, created_at, resolved_at')
      .in('status', ['ACCEPTED', 'DECLINED'])
      .not('resolved_at', 'is', null)
      .gte('created_at', windowStart),
    supabase
      .from('requests')
      .select('id, source, student_name, subject, created_at')
      .eq('status', 'open'),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'TUTOR')
      .eq('status', 'PENDING'),
    fetchAllTutors(supabase),
  ]);

  // Fetch tutor names for availability requests
  const availTutorIds = [...new Set((availRows ?? []).map(r => r.tutor_id))];
  const tutorNameMap = new Map<string, string>();
  if (availTutorIds.length > 0) {
    const { data: tutorRows } = await supabase.from('users').select('id, name').in('id', availTutorIds);
    for (const t of tutorRows ?? []) tutorNameMap.set(t.id, t.name);
  }

  const pendingAvailabilityItems: PendingAvailabilityItem[] = (availRows ?? []).map(r => {
    const name = tutorNameMap.get(r.tutor_id) ?? 'Unknown';
    return {
      tutorName:     name,
      tutorInitials: initials(name),
      requestType:   r.request_type,
      reason:        r.reason,
    };
  });

  // Build response time leaderboard for all tutors with activity in the 90-day window
  const leaderboard = computeLeaderboard(
    (resolvedProposals ?? [])
      .filter((p): p is typeof p & { tutor_id: string } => p.tutor_id !== null)
      .map(p => ({
        tutorId:    p.tutor_id,
        createdAt:  p.created_at,
        resolvedAt: p.resolved_at!,
      }))
  );

  // Fetch names for all tutors in the leaderboard (may differ from availTutorIds)
  const leaderboardTutorIds = [...leaderboard.keys()];
  const leaderboardNameMap = new Map<string, string>(tutorNameMap);
  const missingIds = leaderboardTutorIds.filter(id => !leaderboardNameMap.has(id));
  if (missingIds.length > 0) {
    const { data: extraRows } = await supabase.from('users').select('id, name').in('id', missingIds);
    for (const t of extraRows ?? []) leaderboardNameMap.set(t.id, t.name);
  }

  // Sort: ranked tutors first (ascending rank), then unranked by avgMs ascending
  const leaderboardRows: LeaderboardRow[] = leaderboardTutorIds
    .map(id => {
      const entry = leaderboard.get(id)!;
      return { tutorId: id, tutorName: leaderboardNameMap.get(id) ?? 'Unknown', ...entry };
    })
    .sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (a.rank !== null) return -1;
      if (b.rank !== null) return 1;
      return a.avgMs - b.avgMs;
    });

  const pendingReviewItems: PendingReviewItem[] = (reviewRows ?? []).map(r => {
    const tutorName  = (r.users as { name: string } | null)?.name ?? 'Unknown';
    const subjectName = (r.subjects as { name: string } | null)?.name ?? '';
    return { tutorName, tutorInitials: initials(tutorName), subjectName };
  });
  const openRequests = openRequestRows ?? [];
  const stalledCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const stalledRequests: StalledRequest[] = openRequests
    .filter(r => r.created_at <= stalledCutoff)
    .map(r => ({
      id:          r.id,
      studentName: r.student_name,
      subject:     r.subject ?? null,
      source:      r.source,
      createdAt:   r.created_at,
    }));
  const pending      = INVITATIONS.filter(i => i.status === 'pending');
  const declined     = INVITATIONS.filter(i => i.status === 'declined');
  const expired      = INVITATIONS.filter(i => i.status === 'expired');
  const accepted7d   = INVITATIONS.filter(i => i.status === 'accepted').length;

  const activeTutors = realTutors.length;
  const onboarding   = onboardingCount ?? 0;
  const atCap        = realTutors.filter(t => t.hoursCurrent >= t.hoursMax).length;
  const underbooked  = realTutors.filter(t => t.hoursCurrent < t.hoursMin).length;

  const totalCurrent = realTutors.reduce((a, t) => a + t.hoursCurrent, 0);
  const totalMax     = realTutors.reduce((a, t) => a + t.hoursMax, 0);
  const capacityPct  = totalMax > 0 ? Math.round((totalCurrent / totalMax) * 100) : 0;

  const pendingReviews = pendingReviewItems.length;
  const pendingAvailability = pendingAvailabilityItems.length;

  const hasAlerts = declined.length > 0 || expired.length > 0 || pendingReviews > 0 || pendingAvailability > 0;

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
              {getGreeting(userTz)}, {firstName}
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
            trend={
              capacityPct === 0
                ? { dir: 'flat', text: 'No sessions booked yet' }
                : capacityPct < 40
                  ? { dir: 'down', text: 'Low utilization', warn: true }
                  : capacityPct < 80
                    ? { dir: 'up', text: 'Healthy utilization' }
                    : { dir: 'up', text: 'Near capacity', warn: true }
            }
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
              pendingAvailabilityRequests={pendingAvailability}
            />
          </div>
        )}

        {/* ── 2×2 grid ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 items-start">
          <DashCard
            title="Needs your attention"
            subtitle="Open requests waiting 48+ hours to be matched"
          >
            <StalledRequestList items={stalledRequests} />
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
            <TeamSnapshot tutors={realTutors} />
          </DashCard>

          <DashCard
            title="Subject pending review"
            subtitle="Tutor subject changes awaiting approval"
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

          <DashCard
            title="Availability requests"
            subtitle="Tutor availability changes awaiting approval"
          >
            <PendingAvailabilityList items={pendingAvailabilityItems} />
          </DashCard>
        </div>

        {/* ── Response time leaderboard ──────────────────────────────────────── */}
        <div className="mt-4">
          <DashCard
            title="Response time leaderboard"
            subtitle="Average time to accept or decline a proposal · last 90 days · ranked tutors have 3+ proposals"
          >
            <ResponseTimeLeaderboard rows={leaderboardRows} />
          </DashCard>
        </div>

      </div>
    </div>
  );
}
