'use client';

import { useState } from 'react';
import type { TuitionRequest } from '@/lib/types/domain';

interface Props {
  onClose: () => void;
  onCreate: (request: TuitionRequest) => void;
}

export function NewRequestModal({ onClose, onCreate }: Props) {
  const [studentName,  setStudentName]  = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [subject,      setSubject]      = useState('');
  const [timezone,     setTimezone]     = useState('America/New_York');
  const [startDate,    setStartDate]    = useState('');
  const [notes,        setNotes]        = useState('');
  const [offeredRate,  setOfferedRate]  = useState<number>(20);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSubmit() {
    if (!studentName.trim()) { setError('Student name is required'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name:  studentName.trim(),
          student_email: studentEmail.trim(),
          subject:       subject.trim() || null,
          timezone:      timezone || null,
          start_date:    startDate || null,
          notes:         notes.trim() || null,
          offered_rate:  offeredRate,
        }),
      });
      const body = await res.json() as { id?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Failed to create request');
        return;
      }
      const newRequest: TuitionRequest = {
        id:           body.id!,
        source:       'manual',
        status:       'open',
        studentName:  studentName.trim(),
        studentEmail: studentEmail.trim(),
        subject:      subject.trim() || '—',
        subjectId:    '',
        tuples:       [],
        tz:           timezone,
        startDate:    startDate || '—',
        notes:        notes.trim(),
        receivedAt:   'Just now',
        offeredRate,
      };
      onCreate(newRequest);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-surface-1 rounded-2xl w-full max-w-[440px] p-6 shadow-[0_16px_48px_rgba(22,32,51,0.20)]"
      >
        <h2 className="text-base font-semibold text-fg-1 mb-4">New request</h2>

        <div className="flex flex-col gap-3">
          <Field label="Student name *">
            <input
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              placeholder="Jane Smith"
              className={inputCls}
            />
          </Field>

          <Field label="Student email">
            <input
              type="email"
              value={studentEmail}
              onChange={e => setStudentEmail(e.target.value)}
              placeholder="jane@example.com"
              className={inputCls}
            />
          </Field>

          <Field label="Subject">
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="AP Calculus BC"
              className={inputCls}
            />
          </Field>

          <Field label="Offered rate">
            <div className="flex gap-1.5">
              {[20, 25, 30, 35, 40].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setOfferedRate(r)}
                  className={`flex-1 h-8 rounded-lg text-[12px] font-semibold border transition-colors ${
                    offeredRate === r
                      ? 'bg-brand-ink text-white border-brand-ink'
                      : 'bg-surface-1 text-fg-2 border-border-default hover:bg-surface-2'
                  }`}
                >
                  ${r}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Timezone">
              <input
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                placeholder="America/New_York"
                className={inputCls}
              />
            </Field>
            <Field label="Start date">
              <input
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                placeholder="May 20"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any context about the student or request…"
              className="w-full px-3 py-2 border border-border-default rounded-lg text-[13px] text-fg-1 bg-surface-1 resize-y focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
            />
          </Field>
        </div>

        {error && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-surface-2 text-fg-2 hover:bg-surface-3 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !studentName.trim()}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-brand-ink text-white hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create request'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-fg-2 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full h-9 px-3 border border-border-default rounded-lg text-[13px] text-fg-1 bg-surface-1 focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted';
