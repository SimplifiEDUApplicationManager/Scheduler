'use client';

import { useState } from 'react';
import type { Tutor, TuitionRequest } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { overlapsTuple, DAY_NAMES_FULL, fmtRange } from '@/lib/utils/tutors';

interface ProposeModalProps {
  tutor: Tutor;
  request: TuitionRequest | null;
  onClose: () => void;
  /** Called with the tutor's name on successful submission. */
  onSend: (tutorName: string) => void;
  asanaTaskId?: string;
}

/** Converts a date string to YYYY-MM-DD for Postgres, or null if unparseable/ASAP/etc. */
function toIsoDate(s?: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function ProposeModal({ tutor, request, onClose, onSend, asanaTaskId }: ProposeModalProps) {
  const [notes,      setNotes]      = useState(request?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/proposals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutor_id:           tutor.id,
          student_name:       request?.studentName  ?? '',
          student_email:      request?.studentEmail ?? '',
          subject:            request?.subject      ?? '',
          requested_schedule: request?.tuples       ?? [],
          timezone:           request?.tz           ?? 'America/New_York',
          start_date:         toIsoDate(request?.startDate),
          notes:              notes.trim() || null,
          asana_task_id:      asanaTaskId ?? null,
        }),
      });
      const body = await res.json() as { id?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Failed to send proposal');
        return;
      }
      onSend(tutor.name);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

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
        {request && request.tuples.length > 0 && (
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

        {error && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end mt-5">
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary"   size="md" onClick={handleSend} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send proposal'}
          </Button>
        </div>
      </div>
    </div>
  );
}
