'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import type { Coordinator, CoordinatorInvite } from '@/lib/data/dashboard-mock';

// ── Props ──────────────────────────────────────────────────────────────────
export interface AdminClientProps {
  coordinators: Coordinator[];
  invites: CoordinatorInvite[];
}

// ── Sidebar nav sections ───────────────────────────────────────────────────
type Section = 'coordinators';

// ── Helpers ────────────────────────────────────────────────────────────────
function initialsFrom(s: string): string {
  const parts = s.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

// ── Inline SVG icons ───────────────────────────────────────────────────────
function IconUsers({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="4" r="2.5" />
      <path d="M1 12c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <circle cx="11" cy="4.5" r="2" />
      <path d="M13 12c0-1.8-1.3-3.2-2.8-3.5" />
    </svg>
  );
}
function IconUser({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="4.5" r="2.5" />
      <path d="M2 13c0-2.8 2.2-5 5-5s5 2.2 5 5" />
    </svg>
  );
}
function IconBook({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2h4c1 0 1 1 1 1v9s0-1-1-1H2V2z" />
      <path d="M12 2H8c-1 0-1 1-1 1v9s0-1 1-1h4V2z" />
    </svg>
  );
}
function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <circle cx="7" cy="7" r="5.5" />
      <polyline points="7,4 7,7 9.5,8.5" />
    </svg>
  );
}
function IconGrid({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="5" height="5" rx="1" />
      <rect x="8" y="1" width="5" height="5" rx="1" />
      <rect x="1" y="8" width="5" height="5" rx="1" />
      <rect x="8" y="8" width="5" height="5" rx="1" />
    </svg>
  );
}
function IconSend({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <line x1="11" y1="1" x2="1" y2="6" />
      <line x1="11" y1="1" x2="7.5" y2="11" />
      <line x1="11" y1="1" x2="1" y2="6" />
      <polyline points="1,6 5,7 7.5,11" />
    </svg>
  );
}
function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="2" y1="2" x2="12" y2="12" />
      <line x1="12" y1="2" x2="2" y2="12" />
    </svg>
  );
}
function IconMail({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2.5" width="10" height="7" rx="1.5" />
      <polyline points="1,2.5 6,7 11,2.5" />
    </svg>
  );
}
function IconWarn({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2L16.5 15H1.5L9 2z" />
      <line x1="9" y1="7" x2="9" y2="10.5" />
      <circle cx="9" cy="12.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
function IconDots({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="currentColor">
      <circle cx="2.5" cy="7" r="1.2" />
      <circle cx="7"   cy="7" r="1.2" />
      <circle cx="11.5" cy="7" r="1.2" />
    </svg>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
const SOON_ITEMS = [
  { id: 'tutors',      label: 'Tutors',          icon: IconUser  },
  { id: 'subjects',    label: 'Subjects',         icon: IconBook  },
  { id: 'audit',       label: 'Audit log',        icon: IconClock },
  { id: 'metrics',     label: 'Global metrics',   icon: IconGrid  },
  { id: 'impersonate', label: 'Impersonate',      icon: IconSend  },
];

function AdminSidebar({ section, setSection }: { section: Section; setSection: (s: Section) => void }) {
  return (
    <aside className="w-60 bg-white border-r border-border-default flex flex-col shrink-0 py-[18px] px-3">
      <div className="px-2.5 pb-3.5 border-b border-neutral-100 mb-2.5">
        <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-fg-muted">
          Super Admin
        </div>
        <div className="text-sm font-semibold mt-0.5">Simplifi EDU · Platform</div>
      </div>

      <NavLabel>Manage</NavLabel>
      <NavItem
        id="coordinators"
        label="Coordinators"
        icon={IconUsers}
        active={section === 'coordinators'}
        onClick={() => setSection('coordinators')}
      />

      <NavLabel className="mt-[18px]">Coming later</NavLabel>
      {SOON_ITEMS.map(item => (
        <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} disabled />
      ))}
    </aside>
  );
}

function NavLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] uppercase text-fg-muted mb-1 ${className ?? ''}`}>
      {children}
    </div>
  );
}

function NavItem({
  label, icon: Icon, active, disabled, onClick,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[7px] border-none text-left mb-px"
      style={{
        background: active ? '#F5F5F5' : (hover && !disabled ? '#FAFAFA' : 'transparent'),
        color:      disabled ? '#D4D4D8' : (active ? '#18181B' : '#52525B'),
        fontSize: 13, fontWeight: active ? 600 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <Icon size={14} />
      <span className="flex-1">{label}</span>
      {disabled && (
        <span
          className="text-[9px] font-semibold px-1.5 py-px rounded-xs"
          style={{ color: '#D4D4D8', background: '#FAFAFA', border: '1px solid #F5F5F5' }}
        >
          Soon
        </span>
      )}
    </button>
  );
}

// ── Coordinators page ──────────────────────────────────────────────────────
interface Confirm { kind: 'revoke' | 'deactivate'; id: string; name: string }
interface ToastState { msg: string; kind: 'success' | 'neutral' }

function CoordinatorsPage({
  coords,
  setCoords,
  invites,
  setInvites,
}: {
  coords: Coordinator[];
  setCoords: React.Dispatch<React.SetStateAction<Coordinator[]>>;
  invites: CoordinatorInvite[];
  setInvites: React.Dispatch<React.SetStateAction<CoordinatorInvite[]>>;
}) {
  const [showInvite,  setShowInvite]  = useState(false);
  const [confirm,     setConfirm]     = useState<Confirm | null>(null);
  const [toast,       setToast]       = useState<ToastState | null>(null);

  const activeCount  = coords.filter(c => c.status === 'active').length;
  const pendingCount = invites.filter(i => i.status === 'pending').length;
  const regions      = new Set(coords.filter(c => c.status === 'active').map(c => c.region)).size;

  const pushToast = (msg: string, kind: 'success' | 'neutral' = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3600);
  };

  const sendInvite = (data: { email: string; name: string; region: string }) => {
    const inv: CoordinatorInvite = {
      id: `cinv-${Date.now()}`,
      ...data,
      invitedBy: 'You',
      sentAt:    'just now',
      expiresIn: '7 days',
      status:    'pending',
    };
    setInvites(prev => [inv, ...prev]);
    setShowInvite(false);
    pushToast(`Invite sent to ${data.email}`);
  };

  const resendInvite = (id: string) => {
    const inv = invites.find(i => i.id === id);
    setInvites(prev => prev.map(i =>
      i.id === id ? { ...i, sentAt: 'just now', expiresIn: '7 days', warning: null } : i,
    ));
    pushToast(`Invite to ${inv?.email} resent`);
  };

  const revokeInvite = (id: string) => {
    const inv = invites.find(i => i.id === id);
    setInvites(prev => prev.filter(i => i.id !== id));
    pushToast(`Invite to ${inv?.email} revoked`, 'neutral');
    setConfirm(null);
  };

  const deactivate = (id: string) => {
    const c = coords.find(x => x.id === id);
    setCoords(prev => prev.map(x =>
      x.id === id
        ? { ...x, status: 'inactive', deactivatedAt: 'just now', deactivatedReason: 'Deactivated by admin', activeTutors: 0, activeStudents: 0, openRequests: 0 }
        : x,
    ));
    pushToast(`${c?.name} deactivated`, 'neutral');
    setConfirm(null);
  };

  const reactivate = (id: string) => {
    const c = coords.find(x => x.id === id);
    setCoords(prev => prev.map(x =>
      x.id === id ? { ...x, status: 'active', deactivatedAt: null, deactivatedReason: null } : x,
    ));
    pushToast(`${c?.name} reactivated`);
  };

  return (
    <div className="px-8 py-7 max-w-[1280px] mx-auto">
      {/* Page header */}
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold m-0 font-display tracking-tight">
            Coordinators
          </h1>
          <p className="text-sm text-fg-3 mt-1.5 m-0 max-w-[640px]">
            Invite new coordinators and manage the team.
            Coordinators get access to tutors, student requests, and scheduling for their region.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 h-10 px-[18px] rounded-[9px] bg-neutral-900 text-white border-none text-sm font-bold cursor-pointer shrink-0 hover:bg-neutral-800 transition-colors"
        >
          <IconSend size={12} />
          Invite coordinator
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <MetricTile label="Active"          value={activeCount}  sub="coordinators" accent="#3F9C8B" />
        <MetricTile label="Pending invites" value={pendingCount} sub={pendingCount === 1 ? 'invite' : 'invites'} accent={pendingCount ? '#B08968' : '#A1A1AA'} />
        <MetricTile label="Regions covered" value={regions}      sub="geographies"  accent="#52525B" />
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <PageSection title="Pending invites" count={invites.length}>
          <div className="border border-border-default rounded-[10px] overflow-hidden bg-white">
            {invites.map((inv, i) => (
              <InviteRow
                key={inv.id}
                invite={inv}
                last={i === invites.length - 1}
                onResend={() => resendInvite(inv.id)}
                onRevoke={() => setConfirm({ kind: 'revoke', id: inv.id, name: inv.email })}
              />
            ))}
          </div>
        </PageSection>
      )}

      {/* Coordinators table */}
      <PageSection title="All coordinators" count={coords.length}>
        <div className="border border-border-default rounded-[10px] overflow-hidden bg-white">
          {/* Table header */}
          <div
            className="grid gap-4 px-[18px] py-2.5 border-b border-neutral-100 bg-surface-2 text-[10px] font-bold tracking-[0.06em] uppercase text-fg-3"
            style={{ gridTemplateColumns: '2fr 1.3fr 1fr 0.9fr 60px' }}
          >
            <div>Coordinator</div>
            <div>Region · Role</div>
            <div>Workload</div>
            <div>Last active</div>
            <div />
          </div>
          {coords.map((c, i) => (
            <CoordinatorRow
              key={c.id}
              coordinator={c}
              last={i === coords.length - 1}
              onDeactivate={() => setConfirm({ kind: 'deactivate', id: c.id, name: c.name })}
              onReactivate={() => reactivate(c.id)}
            />
          ))}
        </div>
      </PageSection>

      {/* Modals */}
      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onSend={sendInvite} />
      )}
      {confirm && (
        <ConfirmModal
          confirm={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.kind === 'revoke')     revokeInvite(confirm.id);
            if (confirm.kind === 'deactivate') deactivate(confirm.id);
          }}
        />
      )}
      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </div>
  );
}

// ── MetricTile ─────────────────────────────────────────────────────────────
function MetricTile({ label, value, sub, accent }: {
  label: string; value: number; sub: string; accent: string;
}) {
  return (
    <div className="flex items-center gap-3.5 bg-white border border-border-default rounded-[10px] px-[18px] py-3.5">
      <div className="w-1 h-9 rounded-sm shrink-0" style={{ background: accent }} />
      <div className="flex-1">
        <div className="text-[10px] font-bold tracking-[0.06em] uppercase text-fg-3">{label}</div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-[24px] font-bold tabular-nums">{value}</span>
          <span className="text-xs text-fg-3">{sub}</span>
        </div>
      </div>
    </div>
  );
}

// ── PageSection ────────────────────────────────────────────────────────────
function PageSection({ title, count, children }: {
  title: string; count: number; children: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <div className="flex items-baseline gap-2 mb-2.5">
        <h2 className="text-sm font-bold m-0 font-display">{title}</h2>
        <span className="text-[11px] text-fg-muted tabular-nums">{count}</span>
      </div>
      {children}
    </div>
  );
}

// ── InviteRow ──────────────────────────────────────────────────────────────
function InviteRow({ invite, last, onResend, onRevoke }: {
  invite: CoordinatorInvite;
  last: boolean;
  onResend: () => void;
  onRevoke: () => void;
}) {
  const expiringSoon = !!invite.warning;
  const displayName  = invite.name || invite.email;
  return (
    <div
      className="grid gap-4 items-center px-[18px] py-3.5"
      style={{
        gridTemplateColumns: '2fr 1.5fr 1fr auto',
        borderBottom: last ? 'none' : '1px solid #F5F5F5',
        background: expiringSoon ? '#FFFBF0' : '#fff',
      }}
    >
      {/* Name / email */}
      <div className="flex items-center gap-3">
        <Avatar initials={initialsFrom(displayName)} size="md" tone="neutral" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg-1 truncate">{displayName}</div>
          {invite.name && (
            <div className="text-[11px] text-fg-3">{invite.email}</div>
          )}
        </div>
      </div>

      {/* Region + invited by */}
      <div className="text-xs text-fg-2">
        <div>{invite.region}</div>
        <div className="text-[11px] text-fg-muted mt-0.5">
          Invited by {invite.invitedBy} · {invite.sentAt}
        </div>
      </div>

      {/* Status badge */}
      <div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-[11px] font-semibold"
          style={{
            background: expiringSoon ? '#FEF3C7' : '#FAFAFA',
            border: `1px solid ${expiringSoon ? '#FDE68A' : '#E4E4E7'}`,
            color: expiringSoon ? '#92400E' : '#52525B',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: expiringSoon ? '#F59E0B' : '#B08968' }}
          />
          Pending · expires in {invite.expiresIn}
        </span>
        {expiringSoon && (
          <div className="text-[10px] text-warning-ink mt-1">{invite.warning}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <GhostButton onClick={onResend}>Resend</GhostButton>
        <GhostButton onClick={onRevoke} danger>Revoke</GhostButton>
      </div>
    </div>
  );
}

// ── CoordinatorRow ─────────────────────────────────────────────────────────
// "You" is hardcoded to 'coord-meg' to match the hi-fi mock
const ME_COORDINATOR_ID = 'coord-meg';

function CoordinatorRow({ coordinator: c, last, onDeactivate, onReactivate }: {
  coordinator: Coordinator;
  last: boolean;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const isInactive = c.status === 'inactive';
  const isMe       = c.id === ME_COORDINATOR_ID;
  return (
    <div
      className="grid gap-4 items-center px-[18px] py-3.5 bg-white"
      style={{
        gridTemplateColumns: '2fr 1.3fr 1fr 0.9fr 60px',
        borderBottom: last ? 'none' : '1px solid #F5F5F5',
        opacity: isInactive ? 0.68 : 1,
      }}
    >
      {/* Name / email */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar initials={c.initials} size="md" tone={isInactive ? 'neutral' : 'brand'} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-semibold truncate"
              style={{
                color: isInactive ? '#71717A' : '#18181B',
                textDecoration: isInactive ? 'line-through' : 'none',
              }}
            >
              {c.name}
            </span>
            {isMe && (
              <span className="text-[9px] font-bold tracking-[0.04em] uppercase px-1.5 py-px rounded-xs bg-brand-teal-50 text-brand-teal-700">
                You
              </span>
            )}
            {isInactive && (
              <span className="text-[9px] font-bold tracking-[0.04em] uppercase px-1.5 py-px rounded-xs bg-surface-3 text-fg-3">
                Inactive
              </span>
            )}
          </div>
          <div className="text-[11px] text-fg-3 mt-px">{c.email}</div>
        </div>
      </div>

      {/* Region / role */}
      <div className="text-xs text-fg-2">
        <div className="font-medium">{c.region}</div>
        <div className="text-[11px] text-fg-muted mt-px">{c.role}</div>
      </div>

      {/* Workload */}
      <div>
        {isInactive ? (
          <div className="text-[11px] text-fg-muted">{c.deactivatedReason ?? 'Deactivated'}</div>
        ) : (
          <div className="text-[11px] text-fg-2 leading-relaxed tabular-nums">
            <span><b>{c.activeTutors}</b> tutors</span>
            <span className="text-neutral-300 mx-1">·</span>
            <span><b>{c.activeStudents}</b> students</span>
            <div
              className="text-[10px] mt-px"
              style={{ color: c.openRequests > 4 ? '#92400E' : '#A1A1AA' }}
            >
              {c.openRequests} open request{c.openRequests === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </div>

      {/* Last active */}
      <div className="text-[11px] text-fg-3">
        {isInactive ? c.deactivatedAt : c.lastActive}
      </div>

      {/* Row menu */}
      <div className="flex justify-end">
        <RowMenu isInactive={isInactive} isMe={isMe} onDeactivate={onDeactivate} onReactivate={onReactivate} />
      </div>
    </div>
  );
}

// ── RowMenu (kebab dropdown) ───────────────────────────────────────────────
function RowMenu({ isInactive, isMe, onDeactivate, onReactivate }: {
  isInactive: boolean;
  isMe: boolean;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-7 h-7 flex items-center justify-center rounded-[7px] border border-border-default bg-white text-fg-3 cursor-pointer hover:bg-surface-2 transition-colors"
      >
        <IconDots size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-8 w-44 z-10 bg-white border border-border-default rounded-md p-1"
          style={{ boxShadow: '0 8px 20px rgba(22,32,51,0.12)' }}
        >
          <DropMenuItem label="View activity" disabled />
          <DropMenuItem label="Send message"  disabled />
          <DropMenuItem label="Reset password" disabled />
          <div className="h-px bg-neutral-100 my-1" />
          {isInactive ? (
            <DropMenuItem label="Reactivate" onClick={() => { onReactivate(); setOpen(false); }} />
          ) : (
            <DropMenuItem
              label="Deactivate"
              danger
              disabled={isMe}
              title={isMe ? "Can't deactivate yourself" : undefined}
              onClick={() => { onDeactivate(); setOpen(false); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DropMenuItem({ label, onClick, disabled, danger, title }: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="block w-full text-left px-2.5 py-[7px] rounded-[5px] border-none text-xs font-medium"
      style={{
        background: hover && !disabled ? (danger ? '#FEF2F2' : '#FAFAFA') : 'transparent',
        color: disabled ? '#D4D4D8' : (danger ? '#991B1B' : '#18181B'),
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ── InviteModal ────────────────────────────────────────────────────────────
const REGIONS = [
  'Bay Area', 'Pacific Northwest', 'Southeast', 'Southwest',
  'New England', 'Midwest', 'Texas', 'Remote / National',
] as const;

function InviteModal({ onClose, onSend }: {
  onClose: () => void;
  onSend: (data: { email: string; name: string; region: string }) => void;
}) {
  const [email,   setEmail]   = useState('');
  const [name,    setName]    = useState('');
  const [region,  setRegion]  = useState('');
  const [message, setMessage] = useState(
    'Hi — welcome to Simplifi. Click the link to set up your account. Ping me if you run into anything.',
  );

  const valid = email.includes('@') && region !== '';

  const handleSend = () => {
    if (!valid) return;
    onSend({ email, name: name || email.split('@')[0], region });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: 'rgba(24,24,27,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white flex flex-col"
        style={{ width: 520, borderRadius: 14, boxShadow: '0 20px 50px rgba(22,32,51,0.22)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-100">
          <div>
            <h2 className="text-h4 font-bold m-0 font-display tracking-tight">
              Invite a coordinator
            </h2>
            <p className="text-xs text-fg-3 mt-1 m-0">
              They'll get an email with a setup link, valid for 7 days.
            </p>
          </div>
          <button onClick={onClose} className="flex text-fg-3 hover:text-fg-1 p-1 bg-transparent border-none cursor-pointer transition-colors">
            <IconX size={14} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Email" required>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="rachel.kim@example.com"
                className="w-full px-3 py-2.5 text-sm border border-border-default rounded-md outline-none bg-white text-fg-1 box-border focus:border-border-strong transition-colors"
              />
            </ModalField>
            <ModalField label="Name">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Rachel Kim"
                className="w-full px-3 py-2.5 text-sm border border-border-default rounded-md outline-none bg-white text-fg-1 box-border focus:border-border-strong transition-colors"
              />
            </ModalField>
          </div>

          <ModalField label="Region / Territory" required>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-border-default rounded-md outline-none bg-white text-fg-1 box-border focus:border-border-strong transition-colors"
            >
              <option value="">Select a region…</option>
              {REGIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </ModalField>

          <ModalField label="Personal welcome message (optional)">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder="Add a short note to the invite email…"
              className="w-full px-3 py-2.5 text-sm border border-border-default rounded-md outline-none bg-white text-fg-1 box-border resize-y focus:border-border-strong transition-colors"
              style={{ minHeight: 88 }}
            />
          </ModalField>

          <div
            className="flex gap-2.5 items-start px-3 py-2.5 rounded-md text-[11px] text-fg-2 leading-relaxed"
            style={{ background: '#FAFAFA', border: '1px solid #F5F5F5' }}
          >
            <span className="text-fg-3 mt-px shrink-0"><IconMail size={12} /></span>
            <div>
              <b>What they'll get:</b> A setup email with a one-time link to create their password
              and complete their profile. They'll have <b>Coordinator</b> permissions by default.
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex justify-end gap-2 px-6 py-3.5 border-t border-neutral-100">
          <GhostButton onClick={onClose} className="h-[38px] px-4">Cancel</GhostButton>
          <button
            onClick={handleSend}
            disabled={!valid}
            className="flex items-center gap-1.5 h-[38px] px-[18px] rounded-md border-none text-white text-sm font-bold transition-colors"
            style={{ background: valid ? '#18181B' : '#E4E4E7', cursor: valid ? 'pointer' : 'not-allowed' }}
          >
            <IconSend size={11} />
            Send invite
          </button>
        </footer>
      </div>
    </>
  );
}

function ModalField({ label, required, children }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-fg-2 mb-1.5">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── ConfirmModal ───────────────────────────────────────────────────────────
function ConfirmModal({ confirm, onCancel, onConfirm }: {
  confirm: Confirm;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isRevoke = confirm.kind === 'revoke';
  const title    = isRevoke ? 'Revoke this invite?' : `Deactivate ${confirm.name}?`;
  const body     = isRevoke
    ? `The invite link to ${confirm.name} will stop working immediately. They won't be able to join unless you send a new invite.`
    : `They'll lose access to the platform. Their assigned tutors and students will need to be reassigned to another coordinator. This can be undone from the coordinators list.`;
  const btnLabel = isRevoke ? 'Revoke invite' : 'Deactivate coordinator';

  return (
    <>
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: 'rgba(24,24,27,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onCancel}
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white rounded-xl p-6"
        style={{ width: 420, boxShadow: '0 20px 50px rgba(22,32,51,0.22)' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-3.5 text-danger"
          style={{ background: '#FEF2F2' }}
        >
          <IconWarn size={18} />
        </div>
        <h3 className="text-body-lg font-bold m-0 font-display">{title}</h3>
        <p className="text-sm text-fg-2 leading-relaxed mt-2 mb-5">{body}</p>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onCancel} className="h-[38px] px-4">Cancel</GhostButton>
          <button
            onClick={onConfirm}
            className="h-[38px] px-[18px] rounded-md border-none bg-danger text-white text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity"
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, kind }: ToastState) {
  const dotColor = kind === 'success' ? '#22C55E' : '#71717A';
  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-4 py-3 bg-white border border-border-default rounded-[10px] text-sm font-medium"
      style={{ boxShadow: '0 10px 24px rgba(22,32,51,0.12)' }}
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
      {msg}
    </div>
  );
}

// ── GhostButton ────────────────────────────────────────────────────────────
function GhostButton({
  onClick, danger, children, className,
}: {
  onClick?: () => void;
  danger?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center h-[30px] px-3 rounded-[7px] border text-xs font-semibold cursor-pointer transition-colors hover:bg-surface-2 ${className ?? ''}`}
      style={{
        borderColor: danger ? '#FECACA' : '#E4E4E7',
        color:       danger ? '#991B1B' : '#3F3F46',
        background: 'white',
      }}
    >
      {children}
    </button>
  );
}

// ── Root export ────────────────────────────────────────────────────────────
export function AdminClient({ coordinators, invites: initInvites }: AdminClientProps) {
  const [section,  setSection]  = useState<Section>('coordinators');
  const [coords,   setCoords]   = useState(coordinators);
  const [invites,  setInvites]  = useState(initInvites);

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 bg-surface-2">
      <AdminSidebar section={section} setSection={setSection} />
      <main className="flex-1 overflow-auto min-w-0">
        {section === 'coordinators' && (
          <CoordinatorsPage
            coords={coords}
            setCoords={setCoords}
            invites={invites}
            setInvites={setInvites}
          />
        )}
      </main>
    </div>
  );
}
