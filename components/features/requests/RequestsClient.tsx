'use client';

import { useState } from 'react';
import type { TuitionRequest, Invitation, Tutor, Subject } from '@/lib/data/dashboard-mock';
import { RequestListItem } from './RequestListItem';
import { RequestDetail } from './RequestDetail';
import { ProposeModal } from '@/components/features/tutors/ProposeModal';

interface Props {
  requests: TuitionRequest[];
  invitations: Invitation[];
  tutors: Tutor[];
  subjects: Subject[];
}

export function RequestsClient({ requests, invitations, tutors, subjects }: Props) {
  const [selectedId, setSelectedId] = useState<string>(requests[0]?.id ?? '');
  const [proposeFor, setProposeFor] = useState<{ tutor: Tutor; request: TuitionRequest } | null>(null);
  const [toastName, setToastName] = useState<string | null>(null);

  const selected = requests.find(r => r.id === selectedId) ?? requests[0] ?? null;

  const matchedTutorMap = Object.fromEntries(
    requests
      .filter(r => r.matchedTutorId)
      .map(r => [r.id, tutors.find(t => t.id === r.matchedTutorId)])
  );

  const openCount = requests.filter(r => r.status === 'open').length;

  function handleProposeSend() {
    const name = proposeFor?.tutor.name ?? '';
    setProposeFor(null);
    setToastName(name);
    setTimeout(() => setToastName(null), 3200);
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Left: request list ───────────────────────────────────────────── */}
      <aside className="w-[280px] border-r border-border-default bg-surface-1 flex flex-col shrink-0 min-h-0">
        <div className="px-4 py-3 border-b border-border-default shrink-0">
          <h2 className="text-[13px] font-bold text-fg-1">Requests</h2>
          <p className="text-[11px] text-fg-muted mt-0.5">{openCount} open · {requests.length} total</p>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {requests.map(r => (
            <RequestListItem
              key={r.id}
              request={r}
              selected={r.id === selected?.id}
              matchedTutor={matchedTutorMap[r.id]}
              onClick={() => setSelectedId(r.id)}
            />
          ))}
        </div>
      </aside>

      {/* ── Right: request detail ────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden min-h-0 min-w-0">
        {selected ? (
          <RequestDetail
            request={selected}
            invitations={invitations.filter(i => i.requestId === selected.id)}
            tutors={tutors}
            subjects={subjects}
            matchedTutor={matchedTutorMap[selected.id]}
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

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toastName && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-surface-1 border border-border-default rounded-xl shadow-md text-sm font-medium text-fg-1">
          <div className="w-2 h-2 rounded-full bg-success shrink-0" />
          Proposal sent to {toastName}
        </div>
      )}
    </div>
  );
}
