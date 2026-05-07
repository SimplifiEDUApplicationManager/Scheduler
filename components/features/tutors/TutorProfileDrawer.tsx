'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Tutor, Subject, Invitation } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { TutorProfileOverview } from './TutorProfileOverview';
import { TutorProfileAvailability } from './TutorProfileAvailability';
import { TutorProfileStudents } from './TutorProfileStudents';
import { fakeRoster } from '@/lib/utils/fake-roster';
import { TutorProfileHistory } from './TutorProfileHistory';

type Tab = 'overview' | 'availability' | 'students' | 'history';

interface Props {
  tutor: Tutor;
  subjects: Subject[];
  invitations: Invitation[];
  onClose: () => void;
  onPropose: () => void;
}

export function TutorProfileDrawer({ tutor, subjects, invitations, onClose, onPropose }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const roster = useMemo(() => fakeRoster(tutor, subjects), [tutor, subjects]);

  // Coordinator-managed personality notes fetched from tutor_context
  const [contextPersonality, setContextPersonality] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/tutor-context/${tutor.id}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { context?: { personality?: string } } | null) => {
        if (typeof data?.context?.personality === 'string') {
          setContextPersonality(data.context.personality);
        }
      })
      .catch(() => { /* silently fail — DEV_BYPASS has no session */ });
  }, [tutor.id]);

  async function handleSavePersonality(text: string) {
    const res = await fetch(`/api/tutor-context/${tutor.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { personality: text } }),
    });
    if (res.ok) setContextPersonality(text);
  }
  const sentInvites = invitations.filter(i => i.tutorId === tutor.id);
  const accepted = sentInvites.filter(i => i.status === 'accepted').length;
  const declined = sentInvites.filter(i => i.status === 'declined').length;
  const acceptRate = (accepted + declined) > 0
    ? Math.round(accepted / (accepted + declined) * 100)
    : null;
  const tzLabel = tutor.tz.split('/').pop()?.replace(/_/g, ' ') ?? tutor.tz;

  const TABS: [Tab, string][] = [
    ['overview', 'Overview'],
    ['availability', 'Availability'],
    ['students', `Students · ${roster.length}`],
    ['history', `History · ${sentInvites.length}`],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(24,24,27,0.45)', animation: 'drawerFade 180ms ease' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col h-full bg-white"
        style={{ width: 560, boxShadow: '-24px 0 48px rgba(22,32,51,0.12)', animation: 'drawerSlide 240ms cubic-bezier(0.22,1,0.36,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 flex items-start gap-3.5 shrink-0">
          <Avatar initials={tutor.initials} size="xl" tone="brand" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-xl font-extrabold text-fg-1 tracking-tight leading-none">{tutor.name}</h2>
              {tutor.status === 'onboarding' && (
                <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-warning-bg text-warning-ink uppercase tracking-wide">
                  Onboarding
                </span>
              )}
            </div>
            <div className="text-[12px] text-fg-3">{tutor.email} · {tzLabel}</div>
            <div className="mt-2.5 flex items-center gap-3.5">
              <CapacityBar current={tutor.hoursCurrent} max={tutor.hoursMax} showLabel={false} className="w-36" />
              <span className="text-[11px] text-fg-3">{tutor.hoursCurrent}/{tutor.hoursMax}h</span>
              {acceptRate !== null && (
                <div>
                  <div className="text-[9px] font-bold text-fg-muted uppercase tracking-wide mb-0.5">Accept rate</div>
                  <div className="text-[13px] font-bold text-success-ink">{acceptRate}%</div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 bg-neutral-100 hover:bg-neutral-200 rounded-md p-1.5 text-fg-3 transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* Action strip */}
        <div className="px-6 py-2.5 bg-neutral-50 border-b border-neutral-100 flex gap-2 shrink-0">
          <button
            onClick={onPropose}
            className="h-8 px-3 rounded-lg bg-brand-ink text-white text-[12px] font-semibold flex items-center hover:bg-neutral-700 transition-colors"
          >
            Propose a student
          </button>
          <a
            href={`mailto:${tutor.email}`}
            className="h-8 px-3 rounded-lg border border-border-default text-fg-2 text-[12px] font-semibold flex items-center hover:bg-surface-2 transition-colors"
          >
            Email
          </a>
          <button
            disabled
            title="Coming soon"
            className="h-8 px-3 rounded-lg border border-border-default text-fg-muted text-[12px] font-semibold flex items-center cursor-not-allowed opacity-50"
          >
            View calendar
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 border-b border-neutral-100 shrink-0">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="px-3 py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap"
              style={{
                color: tab === k ? '#18181B' : '#71717A',
                borderBottomColor: tab === k ? '#3F9C8B' : 'transparent',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-neutral-50">
          {tab === 'overview'     && <TutorProfileOverview tutor={tutor} subjects={subjects} contextPersonality={contextPersonality} onSavePersonality={handleSavePersonality} />}
          {tab === 'availability' && <TutorProfileAvailability tutor={tutor} tzLabel={tzLabel} />}
          {tab === 'students'     && <TutorProfileStudents roster={roster} />}
          {tab === 'history'      && <TutorProfileHistory tutor={tutor} invitations={sentInvites} />}
        </div>
      </div>
    </div>
  );
}
