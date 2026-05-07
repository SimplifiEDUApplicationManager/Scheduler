'use client';

import type { TutorEvent, TutorProposal } from '@/lib/types/domain';
import { fmtRange, DAY_NAMES_FULL } from '@/lib/utils/tutors';

interface Props {
  proposal: TutorProposal;
  active: boolean;
  events: TutorEvent[];
  onHover: () => void;
  onLeave: () => void;
  onConsider: () => void;
  onDecline: () => void;
}

export function ProposalCard({ proposal: p, active, events, onHover, onLeave, onConsider, onDecline }: Props) {
  const isPending  = p.status === 'pending';
  const isAccepted = p.status === 'accepted';

  const conflicts = p.tuples.map(tp => {
    const dayEvents = events.filter(e => e.day === tp.day);
    return dayEvents.some(e => e.start < tp.end && e.end > tp.start);
  });

  return (
    <div
      onMouseEnter={isPending ? onHover : undefined}
      onMouseLeave={isPending ? onLeave : undefined}
      className="rounded-xl border transition-all duration-150"
      style={{
        padding: 14,
        border: `1px solid ${active && isPending ? '#18181B' : '#E4E4E7'}`,
        background: isAccepted ? '#F0FDF4' : p.status === 'declined' ? '#FAFAFA' : '#fff',
        boxShadow: active && isPending ? '0 4px 16px rgba(22,32,51,0.08)' : 'none',
        transform: active && isPending ? 'translateY(-1px)' : 'none',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-fg-1 truncate">{p.studentName}</span>
            {isAccepted && (
              <span className="shrink-0 text-[10px] font-bold px-1.5 py-px rounded bg-[#ECFDF5] text-[#047857]">Accepted</span>
            )}
            {p.status === 'declined' && (
              <span className="shrink-0 text-[10px] font-bold px-1.5 py-px rounded bg-[#FEF3C7] text-[#92400E]">Declined</span>
            )}
          </div>
          <div className="text-[12px] text-fg-3 mt-0.5">{p.subject}</div>
        </div>
        <span className="text-[10px] text-fg-muted whitespace-nowrap shrink-0">{p.sentAt}</span>
      </div>

      {/* Tuples */}
      <div className="px-2.5 py-2 bg-surface-2 rounded-lg flex flex-col gap-1.5">
        {p.tuples.map((tp, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-fg-1">{DAY_NAMES_FULL[tp.day]}</span>
            <span className="text-fg-3">·</span>
            <span className="text-fg-2">{fmtRange(tp.start, tp.end)}</span>
            {conflicts[i] && isPending && (
              <span className="ml-auto text-[10px] font-bold text-danger">conflict</span>
            )}
          </div>
        ))}
        <div className="flex justify-between pt-1.5 border-t border-dashed border-border-default text-[11px] text-fg-3">
          <span>Starting {p.startDate}</span>
          <span>+{p.hoursPerWeek}h/wk</span>
        </div>
      </div>

      {/* Notes */}
      {p.notes && (
        <p className="mt-2 text-[12px] text-fg-2 italic leading-relaxed">
          &ldquo;{p.notes}&rdquo;
          <span className="block mt-0.5 text-[10px] text-fg-muted not-italic">— {p.coordinator}</span>
        </p>
      )}

      {/* Decline reason */}
      {p.declineReason && (
        <p className="mt-2 text-[11px] text-fg-3 italic">{p.declineReason}</p>
      )}

      {/* Actions */}
      {isPending && (
        <div className="mt-3 flex flex-col gap-1.5">
          <button
            onClick={onConsider}
            className="w-full h-8 rounded-lg bg-brand-ink text-white text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-neutral-700 transition-colors"
          >
            Consider request →
          </button>
          <button
            onClick={onDecline}
            className="w-full h-7 rounded-lg border border-border-default text-[11px] font-medium text-fg-3 hover:text-danger hover:border-danger transition-colors"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
