'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TuitionRequest, Invitation, Tutor } from '@/lib/types/domain';
import { RequestListItem } from './RequestListItem';
import { RequestDetail } from './RequestDetail';
import { ProposeModal } from '@/components/features/tutors/ProposeModal';
import { NewRequestModal } from './NewRequestModal';

interface Props {
  requests: TuitionRequest[];
  invitations: Invitation[];
  tutors: Tutor[];
  hasAsana: boolean;
}

export function RequestsClient({ requests: initialRequests, invitations, tutors, hasAsana }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reqParam = searchParams.get('req');

  const [requests, setRequests]         = useState(initialRequests);
  const [selectedId, setSelectedId]     = useState<string>(
    (reqParam && initialRequests.some(r => r.id === reqParam))
      ? reqParam
      : (initialRequests[0]?.id ?? ''),
  );
  const [proposeFor, setProposeFor]   = useState<{ tutor: Tutor; request: TuitionRequest } | null>(null);
  const [toastMsg, setToastMsg]       = useState<string | null>(null);
  const [syncing, setSyncing]         = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);

  const selected = requests.find(r => r.id === selectedId) ?? requests[0] ?? null;
  const openCount = requests.filter(r => r.status === 'open').length;

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/coordinator/asana/sync', { method: 'POST' });
      if (res.ok) {
        const { synced } = await res.json() as { synced: number };
        showToast(`Synced ${synced} request${synced === 1 ? '' : 's'} from Asana`);
        router.refresh();
      } else {
        const body = await res.json() as { error?: string };
        showToast(body.error ?? 'Sync failed');
      }
    } catch {
      showToast('Network error — sync failed');
    } finally {
      setSyncing(false);
    }
  }

  function handleProposeSend(tutorName: string) {
    setProposeFor(null);
    showToast(`Proposal sent to ${tutorName}`);
  }

  function handleNewRequestCreated(newReq: TuitionRequest) {
    setShowNewRequest(false);
    setRequests(prev => [newReq, ...prev]);
    setSelectedId(newReq.id);
    showToast('Request created');
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Left: request list ───────────────────────────────────────────── */}
      <aside className="w-[280px] border-r border-border-default bg-surface-1 flex flex-col shrink-0 min-h-0">
        <div className="px-4 py-3 border-b border-border-default shrink-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h2 className="text-[13px] font-bold text-fg-1">Requests</h2>
            <div className="flex items-center gap-1.5">
              {hasAsana && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-6 px-2 rounded text-[10px] font-semibold bg-surface-3 text-fg-2 hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  {syncing ? 'Syncing…' : '↻ Sync'}
                </button>
              )}
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
              {hasAsana
                ? 'No requests yet. Click ↻ Sync to pull from Asana, or + New to enter one manually.'
                : 'No requests yet. Click + New to enter one manually, or connect Asana in Settings.'}
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
            onPropose={tutor => setProposeFor({ tutor, request: selected })}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-fg-muted text-sm">
            Select a request
          </div>
        )}
      </main>

      {/* ── Propose modal ────────────────────────────────────────────────── */}
      {proposeFor && (
        <ProposeModal
          tutor={proposeFor.tutor}
          request={proposeFor.request}
          onClose={() => setProposeFor(null)}
          onSend={handleProposeSend}
        />
      )}

      {/* ── New request modal ────────────────────────────────────────────── */}
      {showNewRequest && (
        <NewRequestModal
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
