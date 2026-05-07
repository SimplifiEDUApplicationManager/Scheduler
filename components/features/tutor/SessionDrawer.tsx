'use client';

import type { TutorEvent } from '@/lib/types/domain';
import { fmtRange, DAY_NAMES_FULL } from '@/lib/utils/tutors';

interface Props {
  session: TutorEvent;
  onClose: () => void;
  onCancel: (id: string, scope: 'one' | 'all') => void;
}

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const STATUS_COLOR: Record<string, string> = {
  upcoming: '#3F9C8B',
  completed: '#A1A1AA',
  cancelled: '#DC2626',
};

export function SessionDrawer({ session: s, onClose, onCancel }: Props) {
  const isCancelled = s.status === 'cancelled';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm mx-4 mb-6 sm:mb-0 p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-fg-1 truncate">{s.title}</div>
            {s.subject && <div className="text-[12px] text-fg-3 mt-0.5">{s.subject}</div>}
          </div>
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${STATUS_COLOR[s.status]}20`, color: STATUS_COLOR[s.status] }}
          >
            {STATUS_LABEL[s.status]}
          </span>
        </div>

        {/* Details */}
        <div className="bg-surface-2 rounded-lg px-3 py-2.5 flex flex-col gap-1.5 mb-4 text-[13px]">
          <div className="flex justify-between">
            <span className="text-fg-3">Day</span>
            <span className="font-medium text-fg-1">{DAY_NAMES_FULL[s.day]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-3">Time</span>
            <span className="font-medium text-fg-1">{fmtRange(s.start, s.end)}</span>
          </div>
          {s.studentName && (
            <div className="flex justify-between">
              <span className="text-fg-3">Student</span>
              <span className="font-medium text-fg-1">{s.studentName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-fg-3">Recurring</span>
            <span className="font-medium text-fg-1">{s.recurring ? 'Weekly' : 'One-time'}</span>
          </div>
        </div>

        {/* Actions */}
        {!isCancelled && s.kind === 'session' && (
          <div className="flex flex-col gap-2">
            {s.recurring && (
              <button
                onClick={() => { onCancel(s.id, 'all'); onClose(); }}
                className="w-full h-9 rounded-lg border border-danger text-danger text-[13px] font-semibold hover:bg-red-50 transition-colors"
              >
                Cancel all recurring sessions
              </button>
            )}
            <button
              onClick={() => { onCancel(s.id, 'one'); onClose(); }}
              className="w-full h-9 rounded-lg border border-border-default text-fg-2 text-[13px] font-medium hover:bg-surface-2 transition-colors"
            >
              Cancel this session only
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full h-8 rounded-lg text-[12px] font-medium text-fg-3 hover:text-fg-1 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
