'use client';

import { useState } from 'react';
import type { Invitation, InvitationStatus, Tutor, TuitionRequest } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';

const STATUS_COLOR: Record<InvitationStatus, string> = {
  pending:         '#F59E0B',
  tutor_accepted:  '#8B5CF6',
  accepted:        '#22C55E',
  declined:        '#DC2626',
  expired:         '#A1A1AA',
  finished:        '#3B82F6',
  client_declined: '#DC2626',
};

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending:         'Pending',
  tutor_accepted:  'Awaiting client',
  accepted:        'Active',
  declined:        'Declined',
  expired:         'Expired',
  finished:        'Finished',
  client_declined: 'Client declined',
};

type Tab = 'all' | InvitationStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: 'all',             label: 'All'              },
  { key: 'pending',         label: 'Pending'          },
  { key: 'tutor_accepted',  label: 'Awaiting client'  },
  { key: 'accepted',        label: 'Active'           },
  { key: 'finished',        label: 'Finished'         },
  { key: 'declined',        label: 'Declined'         },
  { key: 'expired',         label: 'Expired'          },
];

interface Props {
  invitations: Invitation[];
  tutors: Tutor[];
  requests: TuitionRequest[];
}

export function ProposalsClient({ invitations: initialInvitations, tutors, requests }: Props) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [tab, setTab] = useState<Tab>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  // client_declined shows under the declined tab
  const filtered = tab === 'all' ? invitations
    : tab === 'declined' ? invitations.filter(i => i.status === 'declined' || i.status === 'client_declined')
    : invitations.filter(i => i.status === tab);

  const counts: Record<Tab, number> = {
    all:             invitations.length,
    pending:         invitations.filter(i => i.status === 'pending').length,
    tutor_accepted:  invitations.filter(i => i.status === 'tutor_accepted').length,
    accepted:        invitations.filter(i => i.status === 'accepted').length,
    finished:        invitations.filter(i => i.status === 'finished').length,
    declined:        invitations.filter(i => i.status === 'declined' || i.status === 'client_declined').length,
    client_declined: 0, // merged into declined tab
    expired:         invitations.filter(i => i.status === 'expired').length,
  };

  async function handleCoordinatorApprove(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/proposals/${id}/coordinator-approve`, { method: 'POST' });
    if (res.ok) {
      setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'accepted' as InvitationStatus } : inv));
    }
    setBusyId(null);
  }

  async function handleCoordinatorReject(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/proposals/${id}/coordinator-reject`, { method: 'POST' });
    if (res.ok) {
      setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'client_declined' as InvitationStatus } : inv));
    }
    setBusyId(null);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border-default bg-white shrink-0">
        <h1 className="text-[18px] font-extrabold text-fg-1 tracking-tight">Proposals</h1>
        <p className="text-[12px] text-fg-3 mt-0.5">All tutor invitations sent by coordinators</p>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 px-6 border-b border-border-default bg-white shrink-0">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap"
            style={{
              color: tab === key ? '#18181B' : '#71717A',
              borderBottomColor: tab === key ? '#3F9C8B' : 'transparent',
            }}
          >
            {label}
            <span
              className="text-[10px] font-bold px-1.5 py-px rounded-full"
              style={{
                background: tab === key ? '#3F9C8B22' : '#F4F4F5',
                color: tab === key ? '#3F9C8B' : '#71717A',
              }}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-neutral-50 p-5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-fg-muted text-sm">
            No {tab === 'all' ? '' : tab} proposals yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-w-3xl mx-auto">
            {filtered.map(inv => {
              const tutor = tutors.find(t => t.id === inv.tutorId);
              const request = requests.find(r => r.id === inv.requestId);
              const color = STATUS_COLOR[inv.status];

              return (
                <div
                  key={inv.id}
                  className="bg-white border border-neutral-200 rounded-xl px-4 py-3.5"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div className="flex items-center gap-3">
                    {/* Tutor */}
                    <Avatar initials={tutor?.initials ?? '?'} size="sm" tone="brand" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-fg-1">{tutor?.name ?? inv.tutorId}</div>
                      <div className="text-[11px] text-fg-3">Tutor</div>
                    </div>

                    {/* Arrow */}
                    <div className="text-fg-muted text-[13px] px-1 shrink-0">→</div>

                    {/* Student — prefer canonical data from the linked request */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-fg-1">{request?.studentName ?? inv.studentName}</div>
                      <div className="text-[11px] text-fg-3">{request?.subject ?? inv.subject}</div>
                    </div>

                    {/* Status pill */}
                    <span
                      className="text-[10px] font-bold px-2 py-px rounded-full whitespace-nowrap shrink-0"
                      style={{ background: `${color}20`, color }}
                    >
                      {STATUS_LABEL[inv.status]}
                    </span>
                  </div>

                  {/* Approve/Reject buttons for awaiting client */}
                  {inv.status === 'tutor_accepted' && (
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => handleCoordinatorApprove(inv.id)}
                        disabled={busyId === inv.id}
                        className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {busyId === inv.id ? 'Approving\u2026' : 'Client approved'}
                      </button>
                      <button
                        onClick={() => handleCoordinatorReject(inv.id)}
                        disabled={busyId === inv.id}
                        className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Client declined
                      </button>
                    </div>
                  )}

                  {/* Decline reason */}
                  {inv.declineReason && (
                    <div className="mt-2.5 px-2.5 py-1.5 bg-danger-bg rounded-lg text-[11px] text-danger-ink italic leading-snug">
                      &ldquo;{inv.declineReason}&rdquo;
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-fg-muted">
                    <span>Sent {inv.sentAt}</span>
                    <span>·</span>
                    <span>by {inv.sentBy}</span>
                    {request && (
                      <>
                        <span>·</span>
                        <a
                          href={`/dashboard/requests?req=${request.id}`}
                          className="text-brand-primary-ink hover:underline"
                        >
                          View request
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
