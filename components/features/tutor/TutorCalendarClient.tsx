'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Tutor, TutorEvent, TutorProposal, TutorEventKind, TutorEventStatus } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { ProposalCard } from './ProposalCard';
import { DeclineModal } from './DeclineModal';
import { SessionDrawer } from './SessionDrawer';
import { TutorWeekView } from './TutorWeekView';
import { TutorMonthView } from './TutorMonthView';
import { getWeekLabel, getMonthLabel } from '@/lib/utils/tutors';
import { ConsiderModal } from './consider/ConsiderModal';
import { formatResponseTime } from '@/lib/utils/responseTime';

type CalView = 'week' | 'month';

interface Toast { type: 'accept' | 'decline' | 'cancel' | 'error'; name: string; undo?: () => void; }

export interface ResponseTimeStat {
  rank:         number | null;
  avgMs:        number | null;  // null = no proposals yet
  count:        number;
  totalRanked:  number;
}

interface Props {
  me: Tutor;
  initialEvents: TutorEvent[];
  initialProposals: TutorProposal[];
  responseTimeStat: ResponseTimeStat;
}

export function TutorCalendarClient({ me, initialEvents, initialProposals, responseTimeStat }: Props) {
  const [events, setEvents]           = useState<TutorEvent[]>(initialEvents);
  const [eventsLoading, setEventsLoading] = useState(false);
  // Track which week the current events slice belongs to so we can refetch
  // when the user navigates. Ref avoids stale closure in the effect.
  const loadedWeek = useRef<number>(0);
  const [proposals, setProposals]     = useState<TutorProposal[]>(initialProposals);
  const [hoveredId, setHoveredId]     = useState<string | null>(null);
  const [declineFor, setDeclineFor]   = useState<TutorProposal | null>(null);
  const [openSessionId, setOpenId]    = useState<string | null>(null);
  const [calView, setCalView]         = useState<CalView>('week');
  const [weekOffset, setWeekOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [toast, setToast]             = useState<Toast | null>(null);
  const [tourActive, setTourActive]   = useState(false);

  // Listen for tour start/stop events to show sample schedule
  useEffect(() => {
    const onStart = () => setTourActive(true);
    const onStop = () => setTourActive(false);
    window.addEventListener('sim:tour-start', onStart);
    window.addEventListener('sim:tour-stop', onStop);
    return () => {
      window.removeEventListener('sim:tour-start', onStart);
      window.removeEventListener('sim:tour-stop', onStop);
    };
  }, []);

  // Sample events shown during the tour
  const today = new Date();
  const dayOfWeek = today.getDay();
  const sampleEvents: TutorEvent[] = [
    { id: 'tour-1', day: (dayOfWeek + 1) % 7, start: 10, end: 11, title: 'Sarah Johnson · Algebra II', kind: 'session', status: 'upcoming', studentName: 'Sarah Johnson', studentInitials: 'SJ', subject: 'Algebra II', recurring: true },
    { id: 'tour-2', day: (dayOfWeek + 1) % 7, start: 14, end: 15, title: 'Marcus Lee · SAT Prep', kind: 'session', status: 'upcoming', studentName: 'Marcus Lee', studentInitials: 'ML', subject: 'SAT Prep', recurring: true },
    { id: 'tour-3', day: (dayOfWeek + 3) % 7, start: 11, end: 12, title: 'Sarah Johnson · Algebra II', kind: 'session', status: 'upcoming', studentName: 'Sarah Johnson', studentInitials: 'SJ', subject: 'Algebra II', recurring: true },
    { id: 'tour-4', day: (dayOfWeek + 4) % 7, start: 16, end: 17.5, title: 'Emma Chen · AP Physics', kind: 'session', status: 'upcoming', studentName: 'Emma Chen', studentInitials: 'EC', subject: 'AP Physics', recurring: true },
  ];

  const displayEvents = tourActive ? sampleEvents : events;
  const [consideringId, setConsideringId] = useState<string | null>(null);

  // Refetch events from Nylas whenever the user navigates to a different week.
  useEffect(() => {
    if (weekOffset === loadedWeek.current) return;
    loadedWeek.current = weekOffset;
    let cancelled = false;
    setEventsLoading(true);
    fetch(`/api/nylas/events?weekOffset=${weekOffset}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: TutorEvent[]) => { if (!cancelled) setEvents(data); })
      .catch(() => { /* keep showing stale events on error */ })
      .finally(() => { if (!cancelled) setEventsLoading(false); });
    return () => { cancelled = true; };
  }, [weekOffset]);

  // The active proposal to overlay on calendar: hovered one, or first pending by default
  const activeProposal = proposals.find(p =>
    hoveredId ? p.id === hoveredId : p.status === 'pending',
  ) ?? null;
  const pendingCount = proposals.filter(p => p.status === 'pending').length;
  const openSession  = events.find(e => e.id === openSessionId) ?? null;

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  }


  async function handleAcceptWithPlacements(placements: ({ day: number; start: number } | null)[]) {
    const p = proposals.find(prop => prop.id === consideringId);
    if (!p) return;

    const res = await fetch(`/api/proposals/${p.id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placements }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast({ type: 'error', name: body.error ?? 'Failed to accept proposal' });
      return;
    }

    // Don't add calendar events client-side — that happens on coordinator approval
    setProposals(ps => ps.map(prop => prop.id === consideringId ? { ...prop, status: 'tutor_accepted' } : prop));
    setConsideringId(null);
    showToast({ type: 'accept', name: p.studentName });
  }

  async function handleDecline(id: string, reason: string) {
    const name = proposals.find(p => p.id === id)?.studentName ?? '';
    const res = await fetch(`/api/proposals/${id}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast({ type: 'error', name: body.error ?? 'Failed to decline proposal' });
      return;
    }
    setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'declined', declineReason: reason } : p));
    setDeclineFor(null);
    showToast({ type: 'decline', name });
  }

  function handleCancel(id: string, scope: 'one' | 'all') {
    const target = events.find(e => e.id === id);
    if (!target) return;
    const snapshot = events;
    setEvents(es => es.map(e =>
      (e.id === id || (scope === 'all' && e.recurring && e.studentName === target.studentName))
        ? { ...e, status: 'cancelled' }
        : e,
    ));
    showToast({ type: 'cancel', name: target.studentName ?? target.title, undo: () => { setEvents(snapshot); setToast(null); } });
  }

  // ── Pin toggle (long-press) ─────────────────────────────────────────────
  const handleTogglePin = useCallback(async (event: TutorEvent) => {
    // Determine the new state: if currently a session, unpin it; if not, pin it
    const wasCounted = event.kind === 'session';
    const newCounted = !wasCounted;
    const newKind: TutorEventKind = newCounted ? 'session' : 'other';
    const newPinSource = newCounted ? 'manual' as const : null;

    // Optimistic update — toggle all instances if recurring (same masterEventId)
    const snapshot = events;
    setEvents(es => es.map(e => {
      const isTarget = e.id === event.id ||
        (event.masterEventId && e.masterEventId === event.masterEventId);
      return isTarget ? { ...e, kind: newKind, pinSource: newPinSource } : e;
    }));

    // Recalculate capacity from the updated events
    const updatedEvents = events.map(e => {
      const isTarget = e.id === event.id ||
        (event.masterEventId && e.masterEventId === event.masterEventId);
      return isTarget ? { ...e, kind: newKind } : e;
    });
    me.hoursCurrent = Math.round(
      updatedEvents
        .filter(e => e.kind === 'session' && e.status !== 'cancelled')
        .reduce((sum, e) => sum + Math.max(0, e.end - e.start), 0)
      * 100) / 100;

    // Persist to server
    const res = await fetch('/api/event-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nylas_event_id: event.masterEventId ?? event.id,
        master_event_id: event.masterEventId ?? null,
        counted: newCounted,
      }),
    });

    if (!res.ok) {
      // Rollback on failure
      setEvents(snapshot);
      showToast({ type: 'error', name: 'Failed to save pin change' });
    }
  }, [events, me]);

  const calLabel = calView === 'week' ? getWeekLabel(weekOffset) : getMonthLabel(monthOffset);

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Left: profile + proposals ─────────────────────────────── */}
      <aside className="w-[380px] shrink-0 border-r border-border-default bg-white flex flex-col min-h-0">
        {/* Profile */}
        <div data-tour="tutor-profile-card" className="px-5 py-4 border-b border-border-default shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <Avatar initials={me.initials} src={me.photoUrl ?? undefined} size="xl" tone="brand" />
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-fg-1">{me.name}</div>
              <div className="text-[11px] text-fg-3">{me.email}</div>
            </div>
          </div>
          <div data-tour="tutor-capacity" className="p-3 bg-surface-2 rounded-xl flex items-center justify-between gap-4">
            <div>
              <div className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em] mb-1">Capacity · this week</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[22px] font-bold text-fg-1 tabular-nums">{me.hoursCurrent}</span>
                <span className="text-[12px] text-fg-3">/ {me.hoursMax} hours</span>
              </div>
              <div className="text-[11px] text-fg-3 mt-0.5">{me.hoursMax - me.hoursCurrent} remaining</div>
            </div>
            <CapacityBar current={me.hoursCurrent} max={me.hoursMax} showLabel={false} className="w-24" />
          </div>

          {/* Response time leaderboard widget */}
          <div data-tour="tutor-response-time" className="mt-2 p-3 bg-surface-2 rounded-xl">
            <div className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em] mb-1.5">Response time · 90 days</div>
            {responseTimeStat.avgMs === null ? (
              <div className="text-[11px] text-fg-3">No proposals yet — respond to earn a rank.</div>
            ) : responseTimeStat.rank === null ? (
              <div>
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span className="text-[18px] font-bold text-fg-1 tabular-nums">{formatResponseTime(responseTimeStat.avgMs)}</span>
                  <span className="text-[11px] text-fg-3">avg</span>
                </div>
                <div className="text-[11px] text-fg-3">Respond to {3 - responseTimeStat.count} more proposal{3 - responseTimeStat.count === 1 ? '' : 's'} to earn a rank.</div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className="text-[18px] font-bold text-fg-1 tabular-nums">{formatResponseTime(responseTimeStat.avgMs)}</span>
                    <span className="text-[11px] text-fg-3">avg</span>
                  </div>
                  <div className="text-[11px] text-fg-3">of {responseTimeStat.totalRanked} tutors</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em] mb-0.5">Rank</div>
                  <div className="text-[22px] font-extrabold text-brand-primary-ink tabular-nums">#{responseTimeStat.rank}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Proposals header */}
        <div className="px-5 pt-3.5 pb-2 shrink-0">
          <div className="text-[13px] font-bold text-fg-1">Incoming proposals</div>
          <div className="text-[11px] text-fg-3 mt-0.5">
            {pendingCount} pending · hover to preview on calendar
          </div>
        </div>

        {/* Proposals list — only show pending; resolved proposals are view-only on the proposals tab */}
        <div data-tour="tutor-proposals-sidebar" className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 flex flex-col gap-2.5">
          {proposals.filter(p => p.status === 'pending').map(p => (
            <ProposalCard
              key={p.id}
              proposal={p}
              active={activeProposal?.id === p.id}
              events={events}
              onHover={() => setHoveredId(p.id)}
              onLeave={() => setHoveredId(null)}
              onConsider={() => setConsideringId(p.id)}
              onDecline={() => setDeclineFor(p)}
            />
          ))}
          {pendingCount === 0 && (
            <p className="py-6 text-center text-[13px] text-fg-muted">All caught up. No pending proposals.</p>
          )}
        </div>
      </aside>

      {/* ── Right: calendar ────────────────────────────────────────── */}
      <main data-tour="tutor-calendar-grid" className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-border-default flex items-center gap-3 shrink-0 bg-white">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-fg-1">
              My calendar · {calLabel}
              {eventsLoading && <span className="ml-2 text-[11px] font-normal text-fg-muted">Loading…</span>}
            </div>
            <div className="text-[11px] text-fg-muted mt-0.5">
              {activeProposal?.status === 'pending' ? (
                <>
                  Previewing: <b className="text-fg-1">{activeProposal.studentName}</b> · {activeProposal.subject}
                  <span className="text-brand-primary-ink ml-1.5">
                    +{activeProposal.hoursPerWeek}h/wk → {me.hoursCurrent + activeProposal.hoursPerWeek}/{me.hoursMax}h
                  </span>
                </>
              ) : (
                <>{me.tz} · existing sessions shown</>
              )}
            </div>
          </div>

          {/* Week/month nav */}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => calView === 'week' ? setWeekOffset(o => o - 1) : setMonthOffset(o => o - 1)}
              className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-fg-2 hover:bg-surface-2 transition-colors" aria-label="Previous">
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden><path d="M7.5 2.5L4 6l3.5 3.5" /></svg>
            </button>
            <button onClick={() => calView === 'week' ? setWeekOffset(0) : setMonthOffset(0)}
              className="px-2.5 py-1 text-[11px] font-medium text-fg-2 border border-border-default rounded-md hover:bg-surface-2 transition-colors">
              Today
            </button>
            <button onClick={() => calView === 'week' ? setWeekOffset(o => o + 1) : setMonthOffset(o => o + 1)}
              className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-fg-2 hover:bg-surface-2 transition-colors" aria-label="Next">
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden><path d="M4.5 2.5L8 6l-3.5 3.5" /></svg>
            </button>
          </div>

          {/* Week / Month toggle */}
          <div data-tour="tutor-cal-toggle" className="flex items-center p-0.5 bg-surface-3 rounded-lg">
            {(['week', 'month'] as CalView[]).map(v => (
              <button key={v} onClick={() => setCalView(v)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${calView === v ? 'bg-white text-fg-1 shadow-xs' : 'text-fg-3 hover:text-fg-2'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {calView === 'week'
          ? <TutorWeekView events={displayEvents} proposal={tourActive ? null : (activeProposal?.status === 'pending' ? activeProposal : null)} weekOffset={weekOffset} onOpenSession={tourActive ? () => {} : setOpenId} onTogglePin={tourActive ? undefined : handleTogglePin} />
          : <TutorMonthView events={displayEvents} proposal={tourActive ? null : (activeProposal?.status === 'pending' ? activeProposal : null)} monthOffset={monthOffset} onOpenSession={setOpenId} onTogglePin={handleTogglePin} />
        }
      </main>

      {/* Modals */}
      {declineFor && (
        <DeclineModal
          proposal={declineFor}
          onClose={() => setDeclineFor(null)}
          onSubmit={reason => handleDecline(declineFor.id, reason)}
        />
      )}
      {openSession && (
        <SessionDrawer
          session={openSession}
          onClose={() => setOpenId(null)}
          onCancel={handleCancel}
        />
      )}
      {consideringId && (() => {
        const cp = proposals.find(p => p.id === consideringId);
        return cp ? (
          <ConsiderModal
            proposal={cp}
            me={me}
            events={events}
            onClose={() => setConsideringId(null)}
            onAccept={handleAcceptWithPlacements}
            onDecline={() => {
              setConsideringId(null);
              setDeclineFor(cp);
            }}
          />
        ) : null;
      })()}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-white border border-border-default rounded-xl shadow-lg text-[13px] font-medium text-fg-1">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: toast.type === 'accept' ? '#22C55E' : toast.type === 'cancel' || toast.type === 'error' ? '#DC2626' : '#F59E0B' }} />
          <span className="flex-1">
            {toast.type === 'accept' ? `Booked ${toast.name}. Invitation sent.`
              : toast.type === 'cancel' ? `Cancelled session with ${toast.name}.`
              : toast.type === 'error' ? toast.name
              : `Declined. ${toast.name} returns to the request pool.`}
          </span>
          {toast.undo && (
            <button onClick={toast.undo} className="text-[12px] font-bold text-brand-primary-ink hover:underline">Undo</button>
          )}
        </div>
      )}
    </div>
  );
}
