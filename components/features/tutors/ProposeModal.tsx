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

import { toIsoDate } from '@/lib/utils/dates';

export function ProposeModal({ tutor, request, onClose, onSend, asanaTaskId }: ProposeModalProps) {
  const [notes,          setNotes]          = useState(request?.notes ?? '');
  const [studentGrade,   setStudentGrade]   = useState('');
  const [parentName,     setParentName]     = useState('');
  const [testName,       setTestName]       = useState('');
  const [startingScore,  setStartingScore]  = useState('');
  const [goalScore,      setGoalScore]      = useState('');
  const [testDates,      setTestDates]      = useState('');
  const [accommodations, setAccommodations] = useState('');
  const [scheduleNotes,  setScheduleNotes]  = useState('');
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
          offered_rate:       request?.offeredRate ?? null,
          student_grade:      studentGrade.trim() || null,
          parent_name:        parentName.trim() || null,
          test_name:          testName.trim() || null,
          starting_score:     startingScore ? Number(startingScore) : null,
          goal_score:         goalScore ? Number(goalScore) : null,
          test_dates:         testDates.trim() || null,
          accommodations:     accommodations.trim() || null,
          schedule_notes:     scheduleNotes.trim() || null,
          request_id:         request?.id ?? null,
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
        className="bg-surface-1 rounded-2xl w-full max-w-[540px] max-h-[90vh] overflow-y-auto p-6 shadow-[0_16px_48px_rgba(22,32,51,0.20)]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
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
          <div className="bg-surface-2 rounded-lg p-3 mb-5 text-xs text-fg-2">
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

        {/* Student context */}
        <p className="text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em] mb-2">Student context</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-semibold text-fg-2 mb-1">Grade level</label>
            <input
              value={studentGrade} onChange={e => setStudentGrade(e.target.value)}
              placeholder="e.g. 11th grade"
              className="w-full px-3 py-2 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-fg-2 mb-1">Parent / guardian</label>
            <input
              value={parentName} onChange={e => setParentName(e.target.value)}
              placeholder="Parent name"
              className="w-full px-3 py-2 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
            />
          </div>
        </div>

        {/* Test prep details */}
        <p className="text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em] mb-2">Test / prep details</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-fg-2 mb-1">Test or subject</label>
            <input
              value={testName} onChange={e => setTestName(e.target.value)}
              placeholder="e.g. SAT, ACT, AP Calculus BC"
              className="w-full px-3 py-2 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-fg-2 mb-1">Starting score</label>
            <input
              type="number" value={startingScore} onChange={e => setStartingScore(e.target.value)}
              placeholder="e.g. 1180"
              className="w-full px-3 py-2 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-fg-2 mb-1">Goal score</label>
            <input
              type="number" value={goalScore} onChange={e => setGoalScore(e.target.value)}
              placeholder="e.g. 1400"
              className="w-full px-3 py-2 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-fg-2 mb-1">Test dates</label>
            <input
              value={testDates} onChange={e => setTestDates(e.target.value)}
              placeholder="e.g. May 3, June 7"
              className="w-full px-3 py-2 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
            />
          </div>
        </div>

        {/* Accommodations */}
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-fg-2 uppercase tracking-[0.06em] mb-1.5">Accommodations</label>
          <textarea
            value={accommodations} onChange={e => setAccommodations(e.target.value)}
            rows={2}
            placeholder="Any accommodations or special needs…"
            className="w-full px-3 py-2.5 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 resize-y focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
          />
        </div>

        {/* Schedule notes */}
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-fg-2 uppercase tracking-[0.06em] mb-1.5">Availability / schedule notes</label>
          <textarea
            value={scheduleNotes} onChange={e => setScheduleNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Weekday evenings 4–7:30, could stretch to 8:30 on Tues"
            className="w-full px-3 py-2.5 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 resize-y focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
          />
        </div>

        {/* Notes / request body */}
        <label className="block text-[11px] font-semibold text-fg-2 uppercase tracking-[0.06em] mb-1.5">
          Overview / context for tutor
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          className="w-full px-3 py-2.5 border border-border-default rounded-lg text-sm text-fg-1 bg-surface-1 resize-y focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted"
          placeholder="Focus areas, goals, background — supports Markdown formatting"
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
