'use client';

import { useState } from 'react';
import type { TutorProposal } from '@/lib/data/dashboard-mock';

const SUGGESTIONS = [
  "Schedule conflict I can't adjust",
  'Subject not within my strong areas right now',
  'Approaching capacity — can\'t take another weekly slot',
  'Would prefer a different start date',
];

interface Props {
  proposal: TutorProposal;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export function DeclineModal({ proposal: p, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-[460px] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-bold text-fg-1">Decline proposal from {p.coordinator}</h2>
        <p className="text-[13px] text-fg-3 mt-1 mb-4">
          Let the coordinator know why. {p.studentName} returns to the unassigned pool.
        </p>

        {/* Quick-pick chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => setReason(s)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
              style={{
                border: `1px solid ${reason === s ? '#18181B' : '#E4E4E7'}`,
                background: reason === s ? '#18181B' : '#fff',
                color: reason === s ? '#fff' : '#52525B',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Additional context (optional)…"
          className="w-full px-3 py-2 border border-border-default rounded-lg text-[13px] resize-none outline-none focus:border-fg-3"
        />

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border-default text-[13px] font-medium text-fg-2 hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason || 'No reason provided')}
            className="h-9 px-4 rounded-lg bg-danger text-white text-[13px] font-semibold hover:bg-red-700 transition-colors"
          >
            Send decline
          </button>
        </div>
      </div>
    </div>
  );
}
