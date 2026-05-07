import { useState } from 'react';
import type { Tutor, TuitionRequest } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { overlapsTuple, DAY_NAMES_FULL, fmtRange } from '@/lib/utils/tutors';

interface ProposeModalProps {
  tutor: Tutor;
  request: TuitionRequest | null;
  onClose: () => void;
  onSend: () => void;
}

export function ProposeModal({ tutor, request, onClose, onSend }: ProposeModalProps) {
  const [notes, setNotes] = useState(request?.notes ?? '');

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      {/* Dialog */}
      <div
        onClick={e => e.stopPropagation()}
        className="bg-surface-1 rounded-2xl w-full max-w-[480px] p-6 shadow-[0_16px_48px_rgba(22,32,51,0.20)]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar initials={tutor.initials} size="lg" tone="brand" />
          <div>
            <h2 className="text-base font-semibold text-fg-1">Propose to {tutor.name}</h2>
            <p className="text-xs text-fg-3 mt-0.5">
              {request ? `${request.studentName} · ${request.subject}` : 'New proposal'}
            </p>
          </div>
        </div>

        {/* Requested windows */}
        {request && (
          <div className="bg-surface-2 rounded-lg p-3 mb-4 text-xs text-fg-2">
            <p className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em] mb-2">
              Requested windows
            </p>
            {request.tuples.map((t, i) => {
              const avail = overlapsTuple(tutor.availability, t);
              return (
                <div key={i} className="flex items-center gap-2 font-medium text-fg-1 mb-1 last:mb-0">
                  <span>{DAY_NAMES_FULL[t.day]} · {fmtRange(t.start, t.end)}</span>
                  {avail ? (
                    <span className="text-success-ink text-[11px]">✓ available</span>
                  ) : (
                    <span className="text-danger-ink text-[11px]">✗ conflict</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Notes */}
        <label className="block text-[11px] font-semibold text-fg-2 uppercase tracking-[0.06em] mb-1.5">
          Notes to tutor
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 resize-y focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
          placeholder="Any context for the tutor…"
        />

        {/* Actions */}
        <div className="flex gap-2 justify-end mt-5">
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" onClick={onSend}>Send proposal</Button>
        </div>
      </div>
    </div>
  );
}
