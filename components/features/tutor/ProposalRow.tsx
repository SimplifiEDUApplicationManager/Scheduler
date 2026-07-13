'use client';

import type { TutorProposal, TutorEvent } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';
import { DAY_NAMES } from '@/lib/utils/tutors';

export type DisplayStatus = 'pending' | 'reviewed' | 'accepted' | 'declined' | 'expired' | 'finished' | 'tutor_accepted' | 'client_declined';

interface ConflictEntry { tupleIdx: number; hits: TutorEvent[] }

interface Props {
  proposal: TutorProposal;
  displayStatus: DisplayStatus;
  conflicts: ConflictEntry[];
  declineReason?: string;
  onOpen: () => void;
  onFinish?: () => void;
  finishing?: boolean;
}

const STATUS_META: Record<DisplayStatus, { label: string; bg: string; fg: string; dot: string }> = {
  pending:  { label: 'New',      bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B' },
  reviewed: { label: 'Reviewed', bg: '#EEF2FF', fg: '#3730A3', dot: '#6366F1' },
  accepted: { label: 'Accepted', bg: '#DCFCE7', fg: '#166534', dot: '#22C55E' },
  declined: { label: 'Declined', bg: '#FEE2E2', fg: '#991B1B', dot: '#DC2626' },
  expired:         { label: 'Expired',                    bg: '#F4F4F5', fg: '#71717A', dot: '#A1A1AA' },
  finished:        { label: 'Finished',                   bg: '#DBEAFE', fg: '#1E40AF', dot: '#3B82F6' },
  tutor_accepted:  { label: 'Awaiting client approval',   bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B' },
  client_declined: { label: 'Client declined',            bg: '#FEE2E2', fg: '#991B1B', dot: '#DC2626' },
};

function fmtH(h: number): string {
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60);
  const suf = hr >= 12 ? 'p' : 'a'; const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12}${suf}` : `${h12}:${String(mn).padStart(2, '0')}${suf}`;
}

export function ProposalRow({ proposal: p, displayStatus, conflicts, declineReason, onOpen, onFinish, finishing }: Props) {
  const meta = STATUS_META[displayStatus];
  const needsAction = displayStatus === 'pending' || displayStatus === 'reviewed';
  const initials = p.studentName.split(' ').map(n => n[0]).join('').slice(0, 2);
  const borderColor = displayStatus === 'reviewed' ? '#C7D2FE' : '#E4E4E7';

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      style={{ textAlign: 'left', background: '#fff', border: `1px solid ${borderColor}`, borderRadius: 12, padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: '#18181B', overflow: 'hidden', display: 'block', width: '100%', transition: 'border-color 120ms ease, box-shadow 120ms ease' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#18181B'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(22,32,51,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 16, padding: '16px 18px', alignItems: 'flex-start' }}>
        {/* Avatar */}
        <div style={{ paddingTop: 2 }}>
          <Avatar initials={initials} size="lg" tone="brand" />
        </div>

        {/* Middle — identity + meta */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#18181B' }}>{p.studentName}</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: meta.bg, color: meta.fg, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: meta.dot, flexShrink: 0 }} />
              {meta.label}
            </span>
            {p.wasUpdated && displayStatus === 'pending' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: '#DBEAFE', color: '#1E40AF', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>
                Updated — please re-review
              </span>
            )}
            {needsAction && conflicts.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: '#FEF2F2', color: '#991B1B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>
                ⚠ {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, color: '#52525B', lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <b style={{ color: '#18181B', fontWeight: 600 }}>{p.subject}</b>
            <span style={{ color: '#D4D4D8', margin: '0 8px' }}>·</span>
            {p.hoursPerWeek} hrs/wk
            <span style={{ color: '#D4D4D8', margin: '0 8px' }}>·</span>
            Starts {p.startDate}
            <span style={{ color: '#D4D4D8', margin: '0 8px' }}>·</span>
            <span style={{ color: '#71717A' }}>From {p.coordinator}</span>
          </div>

          {/* Proposed window chips */}
          {needsAction && p.tuples.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {p.tuples.map((t, i) => {
                const bad = conflicts.some(c => c.tupleIdx === i);
                return (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: bad ? '#FEF2F2' : '#F4F4F5', color: bad ? '#991B1B' : '#52525B', border: `1px solid ${bad ? '#FECACA' : '#E4E4E7'}`, whiteSpace: 'nowrap' }}>
                    {DAY_NAMES[t.day]} {fmtH(t.start)}–{fmtH(t.end)}
                  </span>
                );
              })}
            </div>
          )}

          {displayStatus === 'declined' && declineReason && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#991B1B', fontStyle: 'italic' }}>
              Decline reason: &ldquo;{declineReason}&rdquo;
            </div>
          )}
        </div>

        {/* Right — sent time + CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 500 }}>{p.sentAt}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: needsAction ? '#18181B' : '#F4F4F5', color: needsAction ? '#fff' : '#52525B', fontSize: 12, fontWeight: 700 }}>
            {needsAction ? 'Review' : 'View'}
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
              <path d="M2 6h8M7 3l3 3-3 3" />
            </svg>
          </div>
          {displayStatus === 'accepted' && onFinish && (
            <button
              type="button"
              disabled={finishing}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onFinish(); }}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #93C5FD', background: '#3B82F6', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: finishing ? 'not-allowed' : 'pointer', pointerEvents: 'auto', position: 'relative', zIndex: 10, opacity: finishing ? 0.6 : 1 }}
            >
              {finishing ? 'Finishing\u2026' : 'Mark finished'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
