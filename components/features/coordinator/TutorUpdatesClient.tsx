'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import type { PendingAvailabilityRequest } from '@/app/(main)/dashboard/tutor-updates/page';
import type { TutorAvailabilityActivity } from '@/lib/types/domain';

interface Props {
  pendingRequests: PendingAvailabilityRequest[];
  activityFeed:   TutorAvailabilityActivity[];
}

const REQUEST_LABELS: Record<PendingAvailabilityRequest['requestType'], string> = {
  PAUSE:                    'Pause availability',
  LOW_MAX_HOURS:            'Reduce max weekly hours',
  LOW_AVAILABILITY_WINDOWS: 'Low availability windows',
};

const REQUEST_DESCRIPTIONS: Record<PendingAvailabilityRequest['requestType'], (req: PendingAvailabilityRequest) => string> = {
  PAUSE:                    () => 'Wants to hide their availability from coordinator views.',
  LOW_MAX_HOURS:            (r) => `Requesting max of ${(r.details?.requested_hours as number | undefined) ?? '?'} hrs/week (below 6-hour floor).`,
  LOW_AVAILABILITY_WINDOWS: (r) => `Proposed scheduling prefs total ${(r.details?.total_hours as number | undefined)?.toFixed(1) ?? '?'} hrs/week (below 10-hour minimum).`,
};

const ACTIVITY_ICONS: Record<string, string> = {
  scheduling_prefs_updated: '🗓',
  timezone_changed:         '🌐',
  hours_changed:            '⏱',
  paused:                   '⏸',
  resumed:                  '▶',
};

const ACTIVITY_COLORS: Record<string, string> = {
  scheduling_prefs_updated: '#3B82F6',
  timezone_changed:         '#8B5CF6',
  hours_changed:            '#F59E0B',
  paused:                   '#DC2626',
  resumed:                  '#16A34A',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function TutorUpdatesClient({ pendingRequests: initialRequests, activityFeed }: Props) {
  const [requests, setRequests]         = useState(initialRequests);
  const [toast, setToast]               = useState<string | null>(null);
  const [declining, setDeclining]       = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/tutor/availability-request/${id}/approve`, { method: 'POST' });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) { showToast(String(data.error ?? 'Failed to approve')); return; }
      setRequests(prev => prev.filter(r => r.id !== id));
      showToast('Request approved');
    } catch {
      showToast('Failed to approve — check your connection');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDecline(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/tutor/availability-request/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decline_reason: declineReason.trim() || undefined }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) { showToast(String(data.error ?? 'Failed to decline')); return; }
      setRequests(prev => prev.filter(r => r.id !== id));
      setDeclining(null);
      setDeclineReason('');
      showToast('Request declined');
    } catch {
      showToast('Failed to decline — check your connection');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 32px 80px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.015em' }}>Tutor updates</h1>
        <p style={{ fontSize: 13, color: '#71717A', margin: '0 0 28px' }}>Availability change requests needing your approval, and a log of recent tutor availability changes.</p>

        {/* ── Pending approvals ─────────────────────────────────────────────── */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717A', marginBottom: 12 }}>
            Pending approval {requests.length > 0 && <span style={{ marginLeft: 6, background: '#DC2626', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 10 }}>{requests.length}</span>}
          </div>

          {requests.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: '24px 20px', textAlign: 'center', color: '#A1A1AA', fontSize: 13 }}>
              No pending requests — all caught up.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {requests.map(req => (
                <div key={req.id} style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Avatar initials={req.tutorInitials} tone="brand" size="md" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>{req.tutorName}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '2px 8px' }}>
                          {REQUEST_LABELS[req.requestType]}
                        </span>
                        <span style={{ fontSize: 11, color: '#A1A1AA', marginLeft: 'auto' }}>{relativeTime(req.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#52525B', marginBottom: 6 }}>{REQUEST_DESCRIPTIONS[req.requestType](req)}</div>
                      <div style={{ fontSize: 12, color: '#71717A' }}>
                        <span style={{ fontWeight: 600, color: '#3F3F46' }}>Reason: </span>{req.reason}
                      </div>
                    </div>
                  </div>

                  {declining === req.id ? (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F5F5F5' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3F3F46', marginBottom: 6 }}>Decline reason <span style={{ color: '#A1A1AA', fontWeight: 400 }}>(optional)</span></label>
                      <textarea
                        value={declineReason}
                        onChange={e => setDeclineReason(e.target.value)}
                        placeholder="Let the tutor know why their request was declined…"
                        rows={2}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setDeclining(null); setDeclineReason(''); }} style={btnStyle('secondary')}>Back</button>
                        <button onClick={() => handleDecline(req.id)} disabled={actionLoading === req.id} style={{ ...btnStyle('danger'), opacity: actionLoading === req.id ? 0.5 : 1 }}>
                          {actionLoading === req.id ? 'Declining…' : 'Confirm decline'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={!!actionLoading}
                        style={{ ...btnStyle('approve'), opacity: actionLoading ? 0.5 : 1 }}
                      >
                        {actionLoading === req.id ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setDeclining(req.id)}
                        disabled={!!actionLoading}
                        style={{ ...btnStyle('secondary'), opacity: actionLoading ? 0.5 : 1 }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Activity feed ─────────────────────────────────────────────────── */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717A', marginBottom: 12 }}>
            Recent availability changes
          </div>

          {activityFeed.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: '24px 20px', textAlign: 'center', color: '#A1A1AA', fontSize: 13 }}>
              No activity yet — changes will appear here as tutors update their availability.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden' }}>
              {activityFeed.map((event, i) => {
                const color = ACTIVITY_COLORS[event.eventType] ?? '#71717A';
                return (
                  <div
                    key={event.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < activityFeed.length - 1 ? '1px solid #F5F5F5' : 'none' }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                      {ACTIVITY_ICONS[event.eventType] ?? '•'}
                    </div>
                    <Avatar initials={event.tutorInitials} tone="brand" size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>
                        <span style={{ color: '#52525B', fontWeight: 400 }}>{event.tutorName} · </span>
                        {event.summary}
                      </div>
                      {event.eventType === 'scheduling_prefs_updated' && event.details && (
                        <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 2 }}>
                          {String(event.details.total_hours !== undefined ? `${(event.details.total_hours as number).toFixed(1)} hrs/week · ` : '')}
                          {String(event.details.break_duration ?? '')}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#A1A1AA', flexShrink: 0 }}>{relativeTime(event.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 32, right: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, boxShadow: '0 10px 24px rgba(22,32,51,0.12)', fontSize: 13, fontWeight: 500 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: '#22C55E' }} />
          {toast}
        </div>
      )}
    </div>
  );
}

function btnStyle(variant: 'primary' | 'secondary' | 'approve' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = { height: 32, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none' };
  if (variant === 'approve')    return { ...base, background: '#16A34A', color: '#fff' };
  if (variant === 'danger')     return { ...base, background: '#DC2626', color: '#fff' };
  if (variant === 'primary')    return { ...base, background: '#18181B', color: '#fff' };
  return { ...base, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7' };
}
