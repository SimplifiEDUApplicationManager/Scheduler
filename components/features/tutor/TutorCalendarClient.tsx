'use client';

import { useState, useEffect, useRef } from 'react';
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

type CalView = 'week' | 'month';

interface Toast { type: 'accept' | 'decline' | 'cancel' | 'error'; name: string; undo?: () => void; }

interface Props {
  me: Tutor;
  initialEvents: TutorEvent[];
  initialProposals: TutorProposal[];
}

export function TutorCalendarClient({ me, initialEvents, initialProposals }: Props) {
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

    const pl = placements[0];
    if (pl) {
      const initials = p.studentName.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
      const newEvent: TutorEvent = {
        id: `ev-new-${p.id}-${Date.now()}`,
        day: pl.day, start: pl.start, end: pl.start + 1,
        title: `${p.studentName} · ${p.subject}`,
        kind: 'session' as TutorEventKind,
        status: 'upcoming' as TutorEventStatus,
        studentName: p.studentName, studentInitials: initials,
        subject: p.subject, recurring: true,
      };
      setEvents(es => [...es, newEvent]);
    }
    setProposals(ps => ps.map(prop => prop.id === consideringId ? { ...prop, status: 'accepted' } : prop));
    setConsideringId(null);
    showToast({ type: 'accept', name: p.studentName });
  }

  function handleDecline(id: string, reason: string) {
    setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'declined', declineReason: reason } : p));
    const name = proposals.find(p => p.id === id)?.studentName ?? '';
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

  const calLabel = calView === 'week' ? getWeekLabel(weekOffset) : getMonthLabel(monthOffset);

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Left: profile + proposals ─────────────────────────────── */}
      <aside className="w-[380px] shrink-0 border-r border-border-default bg-white flex flex-col min-h-0">
        {/* Profile */}
        <div className="px-5 py-4 border-b border-border-default shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <Avatar initials={me.initials} size="xl" tone="brand" />
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-fg-1">{me.name}</div>
              <div className="text-[11px] text-fg-3">{me.email}</div>
            </div>
          </div>
          <div className="p-3 bg-surface-2 rounded-xl flex items-center justify-between gap-4">
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
        </div>

        {/* Proposals header */}
        <div className="px-5 pt-3.5 pb-2 shrink-0">
          <div className="text-[13px] font-bold text-fg-1">Incoming proposals</div>
          <div className="text-[11px] text-fg-3 mt-0.5">
            {pendingCount} pending · hover to preview on calendar
          </div>
        </div>

        {/* Proposals list */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 flex flex-col gap-2.5">
          {proposals.map(p => (
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
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
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
          <div className="flex items-center p-0.5 bg-surface-3 rounded-lg">
            {(['week', 'month'] as CalView[]).map(v => (
              <button key={v} onClick={() => setCalView(v)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${calView === v ? 'bg-white text-fg-1 shadow-xs' : 'text-fg-3 hover:text-fg-2'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {calView === 'week'
          ? <TutorWeekView events={events} proposal={activeProposal?.status === 'pending' ? activeProposal : null} weekOffset={weekOffset} onOpenSession={setOpenId} />
          : <TutorMonthView events={events} proposal={activeProposal?.status === 'pending' ? activeProposal : null} monthOffset={monthOffset} onOpenSession={setOpenId} />
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
