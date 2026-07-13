'use client';

import { useState, useEffect } from 'react';
import type { Tutor, TutorEvent, TutorProposal, Tuple } from '@/lib/types/domain';
import { ConsiderModal } from './consider/ConsiderModal';
import { DeclineModal } from './DeclineModal';
import { ProposalRow, type DisplayStatus } from './ProposalRow';
import { DEMO_PROPOSAL } from '@/lib/data/demo';

type FilterKey = 'pending' | 'tutor_accepted' | 'accepted' | 'finished' | 'declined' | 'all';

interface EnrichedProposal extends TutorProposal {
  displayStatus: DisplayStatus;
  conflicts: { tupleIdx: number; hits: TutorEvent[] }[];
}

interface Props {
  me: Tutor;
  initialEvents: TutorEvent[];
  initialProposals: TutorProposal[];
}

export function ProposalsClient({ me, initialEvents, initialProposals }: Props) {
  const [events, setEvents]       = useState<TutorEvent[]>(initialEvents);
  const [proposals, setProposals] = useState<TutorProposal[]>(initialProposals);
  const [reviewed, setReviewed]   = useState<Set<string>>(new Set());
  const [declineReasons, setDeclineReasons] = useState<Record<string, string>>({});
  const [filter, setFilter]       = useState<FilterKey>('pending');
  const [consideringId, setConsideringId] = useState<string | null>(null);
  const [declineFor, setDeclineFor]       = useState<TutorProposal | null>(null);
  const [toast, setToast]         = useState<string | null>(null);
  const [busyAction, setBusyAction]       = useState<string | null>(null);

  // When the Danielle tour navigates back to this page via router.push (which
  // may serve a cached server render without the demo proposal), the tour fires
  // sim:inject-demo to add Alex Chen client-side, bypassing the cache entirely.
  useEffect(() => {
    const handler = () => {
      setProposals(prev =>
        prev.some(p => p.id === 'demo-proposal') ? prev : [DEMO_PROPOSAL, ...prev],
      );
    };
    const removeHandler = () => {
      setProposals(prev => prev.filter(p => p.id !== 'demo-proposal'));
    };
    window.addEventListener('sim:inject-demo', handler);
    window.addEventListener('sim:remove-demo', removeHandler);
    return () => {
      window.removeEventListener('sim:inject-demo', handler);
      window.removeEventListener('sim:remove-demo', removeHandler);
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function getDisplayStatus(p: TutorProposal): DisplayStatus {
    if (p.status === 'finished') return 'finished';
    if (p.status === 'tutor_accepted') return 'tutor_accepted';
    if (p.status === 'client_declined') return 'client_declined';
    if (p.status === 'accepted') return 'accepted';
    if (p.status === 'declined') return 'declined';
    if (p.status === 'expired')  return 'expired';
    return reviewed.has(p.id) ? 'reviewed' : 'pending';
  }

  function conflictsFor(p: TutorProposal) {
    return p.tuples
      .map((t, tupleIdx) => ({
        tupleIdx,
        hits: events.filter(e =>
          e.day === t.day && e.kind === 'session' && e.status !== 'cancelled' &&
          e.start < t.end && e.end > t.start,
        ),
      }))
      .filter(c => c.hits.length > 0);
  }

  const enriched: EnrichedProposal[] = proposals.map(p => {
    const ds = getDisplayStatus(p);
    return { ...p, displayStatus: ds, conflicts: ds === 'pending' || ds === 'reviewed' ? conflictsFor(p) : [] };
  });

  const actionCount = enriched.filter(p => p.displayStatus === 'pending' || p.displayStatus === 'reviewed').length;

  const visible = filter === 'all'
    ? enriched
    : filter === 'pending'
    ? enriched.filter(p => p.displayStatus === 'pending' || p.displayStatus === 'reviewed')
    : filter === 'declined'
    ? enriched.filter(p => p.displayStatus === 'declined' || p.displayStatus === 'client_declined')
    : enriched.filter(p => p.displayStatus === filter);

  function openDetail(id: string) {
    const p = proposals.find(prop => prop.id === id);
    if (!p) return;
    setReviewed(r => { const n = new Set(r); n.add(id); return n; });
    setConsideringId(id);
    if (id === 'demo-proposal') {
      window.dispatchEvent(new CustomEvent('sim:demo-opened'));
    }
  }

  async function handleAccept(availability: Tuple[]) {
    const p = proposals.find(prop => prop.id === consideringId);
    if (!p) return;
    setBusyAction(`accept-${p.id}`);

    // ── Demo proposal — use dedicated onboarding endpoint ─────────────────
    if (p.id === 'demo-proposal') {
      const res = await fetch('/api/proposals/demo/accept', { method: 'POST' });
      if (!res.ok) {
        showToast('Error: Failed to accept demo proposal');
        setBusyAction(null);
        return;
      }
      setProposals(ps => ps.map(prop => prop.id === 'demo-proposal' ? { ...prop, status: 'accepted' } : prop));
      setConsideringId(null);
      setBusyAction(null);
      showToast(`Accepted ${p.studentName} · calendar invite sent to family`);
      window.dispatchEvent(new CustomEvent('sim:demo-accepted'));
      return;
    }

    const res = await fetch(`/api/proposals/${p.id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutor_availability: availability }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to accept proposal'}`);
      setBusyAction(null);
      return;
    }

    // Don't add calendar events — that happens on coordinator approval after client confirms
    setProposals(ps => ps.map(prop => prop.id === consideringId ? { ...prop, status: 'tutor_accepted' } : prop));
    setConsideringId(null);
    setBusyAction(null);
    showToast(`Accepted ${p.studentName} · awaiting client approval`);
  }

  async function handleDecline(id: string, reason: string) {
    const p = proposals.find(prop => prop.id === id);
    setBusyAction(`decline-${id}`);

    const res = await fetch(`/api/proposals/${id}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to decline proposal'}`);
      setBusyAction(null);
      return;
    }

    setProposals(ps => ps.map(prop => prop.id === id ? { ...prop, status: 'declined', declineReason: reason } : prop));
    setDeclineReasons(r => ({ ...r, [id]: reason }));
    setDeclineFor(null);
    setConsideringId(null);
    setBusyAction(null);
    showToast(`Declined · ${p?.coordinator.split(' ')[0]} has been notified`);
  }

  async function handleFinish(id: string) {
    setBusyAction(`finish-${id}`);
    const res = await fetch(`/api/proposals/${id}/finish`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to mark as finished'}`);
      setBusyAction(null);
      return;
    }
    const p = proposals.find(prop => prop.id === id);
    setProposals(ps => ps.map(prop => prop.id === id ? { ...prop, status: 'finished' } : prop));
    setBusyAction(null);
    showToast(`${p?.studentName ?? 'Job'} marked as finished`);
  }

  const considering = consideringId ? proposals.find(p => p.id === consideringId) ?? null : null;

  const FILTERS = [
    ['pending',          'Needs response',          actionCount,                                            '#F59E0B'],
    ['tutor_accepted',   'Awaiting client',         enriched.filter(p => p.displayStatus === 'tutor_accepted').length, '#8B5CF6'],
    ['accepted',         'Active',                  enriched.filter(p => p.displayStatus === 'accepted').length, '#22C55E'],
    ['finished',         'Finished',                enriched.filter(p => p.displayStatus === 'finished').length, '#3B82F6'],
    ['declined',         'Declined',                enriched.filter(p => p.displayStatus === 'declined' || p.displayStatus === 'client_declined').length, '#DC2626'],
    ['all',              'All',                     enriched.length,                                        '#52525B'],
  ] as const;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, background: '#FAFAFA' }}>
      {/* Header */}
      <div style={{ padding: '22px 28px 16px', background: '#fff', borderBottom: '1px solid #E4E4E7', flexShrink: 0 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.015em' }}>Proposals</h1>
          <p style={{ fontSize: 12, color: '#71717A', margin: '4px 0 14px' }}>
            Student matches sent by your coordinators. Open a row to review and respond.
          </p>
          <div data-tour="proposals-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map(([k, label, n, c]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 12px', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', background: filter === k ? c : '#F5F5F5', color: filter === k ? '#fff' : '#52525B', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'background 120ms' }}>
                {label}
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, lineHeight: 1.3, background: filter === k ? 'rgba(255,255,255,0.22)' : '#fff', color: filter === k ? '#fff' : '#A1A1AA' }}>{n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 40px' }}>
        <div data-tour="proposals-first-row" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.length === 0 && (
            <div style={{ padding: 64, textAlign: 'center', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12 }}>
              <div style={{ fontSize: 24, color: '#A7F3D0', marginBottom: 10 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#52525B' }}>Inbox zero</div>
              <div style={{ fontSize: 12, color: '#A1A1AA', marginTop: 3 }}>
                No {filter === 'all' ? '' : filter + ' '}proposals right now.
              </div>
            </div>
          )}
          {visible.map((p) => (
            <ProposalRow
              key={p.id}
              proposal={p}
              displayStatus={p.displayStatus}
              conflicts={p.conflicts}
              declineReason={declineReasons[p.id]}
              onOpen={() => openDetail(p.id)}
              onFinish={p.displayStatus === 'accepted' ? () => handleFinish(p.id) : undefined}
              finishing={busyAction === `finish-${p.id}`}
            />
          ))}
        </div>
      </div>

      {considering && (
        <ConsiderModal
          proposal={considering}
          me={me}
          events={events}
          onClose={() => setConsideringId(null)}
          onAccept={handleAccept}
          onDecline={() => { setConsideringId(null); setDeclineFor(considering); }}
        />
      )}

      {declineFor && (
        <DeclineModal
          proposal={declineFor}
          onClose={() => setDeclineFor(null)}
          onSubmit={reason => handleDecline(declineFor.id, reason)}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#18181B', color: '#fff', borderRadius: 10, boxShadow: '0 10px 24px rgba(22,32,51,0.18)', fontSize: 13, fontWeight: 500 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: '#22C55E', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </div>
  );
}
