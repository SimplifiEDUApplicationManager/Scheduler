'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TuitionRequest, Invitation, Tutor, Subject } from '@/lib/types/domain';
import { RequestListItem } from './RequestListItem';
import { RequestDetail } from './RequestDetail';
import { NewRequestModal } from './NewRequestModal';
import { toIsoDate } from '@/lib/utils/dates';

interface Props {
  requests: TuitionRequest[];
  invitations: Invitation[];
  tutors: Tutor[];
  subjects: Subject[];
  coordinatorTz: string;
}

export function RequestsClient({ requests: initialRequests, invitations, tutors, subjects, coordinatorTz }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reqParam = searchParams.get('req');

  const [requests, setRequests]         = useState(initialRequests);
  const [selectedId, setSelectedId]     = useState<string>(
    (reqParam && initialRequests.some(r => r.id === reqParam))
      ? reqParam
      : (initialRequests[0]?.id ?? ''),
  );

  // Sync state when the server re-fetches (e.g. post-create via router.refresh()).
  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);
  const [proposeFor, setProposeFor]   = useState<{ tutor: Tutor; request: TuitionRequest } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [toastMsg, setToastMsg]       = useState<string | null>(null);
  const [showNewRequest, setShowNewRequest] = useState(false);

  const selected = requests.find(r => r.id === selectedId) ?? requests[0] ?? null;
  const openCount = requests.filter(r => r.status === 'open').length;

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  }

  async function handleConfirmPropose() {
    if (!proposeFor) return;
    const { tutor, request: req } = proposeFor;
    setConfirmBusy(true);
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutor_id:           tutor.id,
          student_name:       req.studentName,
          student_email:      req.studentEmail,
          subject:            req.subject,
          requested_schedule: req.tuples,
          timezone:           req.tz,
          start_date:         toIsoDate(req.startDate),
          notes:              req.notes || null,
          asana_task_id:      req.asanaTaskId ?? null,
          offered_rate:       req.offeredRate ?? null,
          request_id:         req.id,
          session_duration_minutes: req.sessionDurationMinutes ?? 60,
          sessions_per_week:        req.sessionsPerWeek ?? 1,
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        showToast(`Error: ${body.error ?? 'Failed to send'}`);
        return;
      }
      // Remove the request from the list (it's now 'proposed')
      setRequests(prev => prev.filter(r => r.id !== req.id));
      showToast(`Proposal sent to ${tutor.name}`);
    } finally {
      setConfirmBusy(false);
      setProposeFor(null);
    }
  }

  function handleNewRequestCreated(newReq: TuitionRequest) {
    setShowNewRequest(false);
    setRequests(prev => [newReq, ...prev]);
    setSelectedId(newReq.id);
    showToast('Request created');
  }

  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    const id = selected.id;
    const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Failed to delete request'); setDeleting(false); return; }
    const remaining = requests.filter(r => r.id !== id);
    setRequests(remaining);
    setSelectedId(remaining[0]?.id ?? '');
    setDeleting(false);
    showToast('Request deleted');
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Left: request list ───────────────────────────────────────────── */}
      <aside className="w-[280px] border-r border-border-default bg-surface-1 flex flex-col shrink-0 min-h-0">
        <div className="px-4 py-3 border-b border-border-default shrink-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h2 className="text-[13px] font-bold text-fg-1">Requests</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNewRequest(true)}
                className="h-6 px-2 rounded text-[10px] font-semibold bg-brand-ink text-white hover:bg-neutral-700 transition-colors"
              >
                + New
              </button>
            </div>
          </div>
          <p className="text-[11px] text-fg-muted">{openCount} open · {requests.length} total</p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {requests.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-fg-muted">
              {'No requests yet. Click + New to enter one manually, or run /sync-requests in Claude.'}
            </div>
          ) : (
            requests.map(r => (
              <RequestListItem
                key={r.id}
                request={r}
                selected={r.id === selected?.id}
                onClick={() => setSelectedId(r.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Right: request detail ────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden min-h-0 min-w-0">
        {selected ? (
          <RequestDetail
            request={selected}
            invitations={invitations.filter(i => i.requestId === selected.id)}
            tutors={tutors}
            coordinatorTz={coordinatorTz}
            onPropose={tutor => setProposeFor({ tutor, request: selected })}
            onDelete={handleDelete}
            deleting={deleting}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-fg-muted text-sm">
            Select a request
          </div>
        )}
      </main>

      {/* ── Confirm propose dialog ────────────────────────────────────────── */}
      {proposeFor && (
        <div onClick={() => setProposeFor(null)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="bg-surface-1 rounded-2xl w-full max-w-[400px] p-6 shadow-[0_16px_48px_rgba(22,32,51,0.20)]">
            <h2 className="text-base font-semibold text-fg-1 mb-2">Send proposal?</h2>
            <p className="text-[13px] text-fg-2 mb-4 leading-relaxed">
              Send <strong>{proposeFor.request.studentName}</strong> · {proposeFor.request.subject} to <strong>{proposeFor.tutor.name}</strong>?
              {((proposeFor.request.sessionsPerWeek ?? 1) > 1 || (proposeFor.request.sessionDurationMinutes ?? 60) !== 60)
                ? ` (${proposeFor.request.sessionsPerWeek ?? 1}× ${proposeFor.request.sessionDurationMinutes ?? 60}m/week)`
                : ''}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setProposeFor(null)} disabled={confirmBusy}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-surface-2 text-fg-2 hover:bg-surface-3 transition-colors">Cancel</button>
              <button onClick={handleConfirmPropose} disabled={confirmBusy}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-brand-ink text-white hover:bg-neutral-700 transition-colors disabled:opacity-50">
                {confirmBusy ? 'Sending…' : 'Send proposal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New request modal ────────────────────────────────────────────── */}
      {showNewRequest && (
        <NewRequestModal
          subjects={subjects}
          onClose={() => setShowNewRequest(false)}
          onCreate={handleNewRequestCreated}
        />
      )}

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-surface-1 border border-border-default rounded-xl shadow-md text-sm font-medium text-fg-1">
          <div className="w-2 h-2 rounded-full bg-success shrink-0" />
          {toastMsg}
        </div>
      )}
    </div>
  );
}
