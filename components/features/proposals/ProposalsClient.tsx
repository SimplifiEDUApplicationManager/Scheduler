'use client';

import { useState } from 'react';
import type { Invitation, InvitationStatus, Tutor, TuitionRequest, Tuple } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';
import { TupleRow } from '@/components/features/tutors/TupleRow';

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

  // ── Edit proposal ──────────────────────────────────────────────────────
  const [editId, setEditId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, unknown>>({});
  const [editTuples, setEditTuples] = useState<Tuple[]>([]);
  const [editBusy, setEditBusy] = useState(false);

  function openEdit(inv: Invitation) {
    setEditId(inv.id);
    setEditFields({
      student_name: inv.studentName,
      student_email: '',
      subject: inv.subject,
      timezone: 'America/New_York',
      notes: '',
      offered_rate: 30,
      session_duration_minutes: 60,
      sessions_per_week: 1,
    });
    setEditTuples([]);
  }

  async function handleEditSave() {
    if (!editId) return;
    setEditBusy(true);
    const res = await fetch(`/api/proposals/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editFields, requested_schedule: editTuples }),
    });
    if (res.ok) {
      setInvitations(prev => prev.map(inv =>
        inv.id === editId ? { ...inv, status: 'pending' as InvitationStatus, studentName: String(editFields.student_name ?? inv.studentName), subject: String(editFields.subject ?? inv.subject) } : inv,
      ));
      setEditId(null);
    }
    setEditBusy(false);
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

                  {/* Edit button for editable proposals */}
                  {(inv.status === 'pending' || inv.status === 'tutor_accepted') && (
                    <div className={`${inv.status === 'tutor_accepted' ? '' : 'mt-2.5'} flex gap-2`}>
                      <button onClick={() => openEdit(inv)}
                        className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-default text-fg-2 hover:bg-surface-2 transition-colors">
                        Edit proposal
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
      {/* ── Edit modal ──────────────────────────────────────────────────── */}
      {editId && (
        <div onClick={() => setEditId(null)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="bg-surface-1 rounded-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto p-6 shadow-[0_16px_48px_rgba(22,32,51,0.20)]">
            <h2 className="text-base font-semibold text-fg-1 mb-4">Edit proposal</h2>
            <div className="flex flex-col gap-3">
              <EditField label="Student name">
                <input value={String(editFields.student_name ?? '')} onChange={e => setEditFields(f => ({ ...f, student_name: e.target.value }))} className={editInput} />
              </EditField>
              <EditField label="Student email">
                <input value={String(editFields.student_email ?? '')} onChange={e => setEditFields(f => ({ ...f, student_email: e.target.value }))} className={editInput} />
              </EditField>
              <EditField label="Subject">
                <input value={String(editFields.subject ?? '')} onChange={e => setEditFields(f => ({ ...f, subject: e.target.value }))} className={editInput} />
              </EditField>
              <div className="grid grid-cols-2 gap-3">
                <EditField label={`Offered rate · $${editFields.offered_rate ?? 30}/hr`}>
                  <input type="range" min={5} max={80} step={5} value={Number(editFields.offered_rate ?? 30)} onChange={e => setEditFields(f => ({ ...f, offered_rate: +e.target.value }))}
                    className="w-full h-2 rounded-full appearance-none bg-neutral-200 accent-brand-ink cursor-pointer" />
                </EditField>
                <EditField label="Timezone">
                  <input value={String(editFields.timezone ?? '')} onChange={e => setEditFields(f => ({ ...f, timezone: e.target.value }))} className={editInput} />
                </EditField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <EditField label={`Session length · ${String(editFields.session_duration_minutes ?? 60)}m`}>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setEditFields(f => ({ ...f, session_duration_minutes: Math.max(15, Number(f.session_duration_minutes ?? 60) - 5) }))} className={stepBtn}>−</button>
                    <div className="flex-1 h-9 flex items-center justify-center border border-border-default rounded-lg text-[13px] font-semibold text-fg-1 bg-surface-1">{String(editFields.session_duration_minutes ?? 60)}m</div>
                    <button type="button" onClick={() => setEditFields(f => ({ ...f, session_duration_minutes: Number(f.session_duration_minutes ?? 60) + 5 }))} className={stepBtn}>+</button>
                  </div>
                </EditField>
                <EditField label={`Sessions / week · ${String(editFields.sessions_per_week ?? 1)}×`}>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setEditFields(f => ({ ...f, sessions_per_week: Math.max(1, Number(f.sessions_per_week ?? 1) - 1) }))} className={stepBtn}>−</button>
                    <div className="flex-1 h-9 flex items-center justify-center border border-border-default rounded-lg text-[13px] font-semibold text-fg-1 bg-surface-1">{String(editFields.sessions_per_week ?? 1)}×</div>
                    <button type="button" onClick={() => setEditFields(f => ({ ...f, sessions_per_week: Number(f.sessions_per_week ?? 1) + 1 }))} className={stepBtn}>+</button>
                  </div>
                </EditField>
              </div>
              <EditField label="Student availability">
                <div className="flex flex-col gap-1.5">
                  {editTuples.map((t, i) => (
                    <TupleRow key={i} tuple={t}
                      onChange={updated => setEditTuples(prev => prev.map((x, j) => j === i ? updated : x))}
                      onRemove={() => setEditTuples(prev => prev.filter((_, j) => j !== i))} />
                  ))}
                  <button type="button" onClick={() => setEditTuples(prev => [...prev, { day: 1, start: 16, end: 20 }])}
                    className="text-[11px] font-semibold text-brand-primary-ink hover:text-brand-primary-deep transition-colors self-start">+ Add window</button>
                </div>
              </EditField>
              <EditField label="Notes">
                <textarea value={String(editFields.notes ?? '')} onChange={e => setEditFields(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 border border-border-default rounded-lg text-[13px] text-fg-1 bg-surface-1 resize-y focus:outline-none focus:border-neutral-400" />
              </EditField>
            </div>
            <p className="text-[11px] text-fg-muted mt-3">Saving will reset the proposal to Pending and give the tutor a fresh 24 hours to respond.</p>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setEditId(null)} className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-surface-2 text-fg-2 hover:bg-surface-3 transition-colors">Cancel</button>
              <button onClick={handleEditSave} disabled={editBusy}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-brand-ink text-white hover:bg-neutral-700 transition-colors disabled:opacity-50">
                {editBusy ? 'Saving…' : 'Save & notify tutor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-fg-2 mb-1">{label}</label>
      {children}
    </div>
  );
}

const editInput = 'w-full h-9 px-3 border border-border-default rounded-lg text-[13px] text-fg-1 bg-surface-1 focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted';
const stepBtn = 'w-9 h-9 rounded-lg border border-border-default bg-surface-1 text-fg-1 text-[16px] font-semibold hover:bg-surface-2 transition-colors flex items-center justify-center shrink-0 cursor-pointer';
