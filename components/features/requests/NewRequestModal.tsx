'use client';

import { useState, useRef, useEffect } from 'react';
import type { TuitionRequest, Subject, Tuple } from '@/lib/types/domain';
import { formatTimezoneLabel } from '@/lib/utils/timezone';
import { TupleRow } from '@/components/features/tutors/TupleRow';

const TIMEZONES = (typeof Intl !== 'undefined' && (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf)
  ? (Intl as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
  : ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'Europe/London', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];

interface Props {
  subjects: Subject[];
  onClose: () => void;
  onCreate: (request: TuitionRequest) => void;
}

export function NewRequestModal({ subjects, onClose, onCreate }: Props) {
  const [studentName,  setStudentName]  = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [subject,      setSubject]      = useState('');
  const [subjectOpen,  setSubjectOpen]  = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [timezone,     setTimezone]     = useState('America/New_York');
  const [tzOpen,       setTzOpen]       = useState(false);
  const [tzSearch,     setTzSearch]     = useState('');
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [notes,        setNotes]        = useState('');
  const [offeredRate,  setOfferedRate]  = useState(30);
  const [duration,     setDuration]     = useState(60);
  const [frequency,    setFrequency]    = useState(1);
  const [tuples,       setTuples]       = useState<Tuple[]>([]);
  const [availText,    setAvailText]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const subjectRef = useRef<HTMLDivElement>(null);
  const tzRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (subjectRef.current && !subjectRef.current.contains(e.target as Node)) setSubjectOpen(false);
      if (tzRef.current && !tzRef.current.contains(e.target as Node)) setTzOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredSubjects = subjectSearch
    ? subjects.filter(s => s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
    : subjects;
  const filteredTz = tzSearch
    ? TIMEZONES.filter(tz => tz.toLowerCase().includes(tzSearch.toLowerCase()) || formatTimezoneLabel(tz).toLowerCase().includes(tzSearch.toLowerCase()))
    : TIMEZONES;

  function parseAvailText() {
    if (!availText.trim()) return;
    const text = availText.toLowerCase();
    const parsed: Tuple[] = [];

    // Time range extraction: "4-8 PM", "5:00 PM - 11 PM", "after 5 PM"
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    const afterMatch = !timeMatch && text.match(/after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);

    let startH = 16, endH = 20; // defaults
    if (timeMatch) {
      let s = parseInt(timeMatch[1]);
      const sPm = timeMatch[3]?.toLowerCase();
      let e = parseInt(timeMatch[4]);
      const ePm = timeMatch[6]?.toLowerCase();
      if (sPm === 'pm' && s < 12) s += 12;
      if (sPm === 'am' && s === 12) s = 0;
      if (ePm === 'pm' && e < 12) e += 12;
      if (ePm === 'am' && e === 12) e = 0;
      if (!sPm && !ePm && s < e && s < 12 && e <= 12) { /* ambiguous, assume PM */ s += 12; e += 12; }
      if (!sPm && ePm === 'pm' && s < 12) s += 12; // "4-8 PM" → both PM
      startH = s;
      endH = e <= s ? e + 24 : e; // cross-midnight
    } else if (afterMatch) {
      let s = parseInt(afterMatch[1]);
      const pm = afterMatch[3]?.toLowerCase();
      if (pm === 'pm' && s < 12) s += 12;
      startH = s;
      endH = 23;
    } else {
      if (/morning/.test(text)) { startH = 8; endH = 12; }
      else if (/afternoon/.test(text)) { startH = 13; endH = 18; }
      else if (/evening/.test(text)) { startH = 18; endH = 23; }
    }

    // Day extraction
    const dayMap: Record<string, number> = {
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    };
    const days: number[] = [];

    if (/weekday|mon\s*[-–]?\s*fri|m\s*[-–]\s*f/.test(text)) {
      days.push(1, 2, 3, 4, 5);
    } else if (/weekend/.test(text)) {
      days.push(0, 6);
    } else if (/every\s*day|all\s*week|any\s*day/.test(text)) {
      days.push(0, 1, 2, 3, 4, 5, 6);
    } else {
      // Extract specific days
      for (const [name, idx] of Object.entries(dayMap)) {
        if (text.includes(name)) {
          if (!days.includes(idx)) days.push(idx);
        }
      }
    }

    if (days.length === 0) days.push(1, 2, 3, 4, 5); // default to weekdays

    for (const day of days) {
      parsed.push({ day, start: startH, end: endH });
    }

    setTuples(prev => [...prev, ...parsed]);
    setAvailText('');
  }

  const canSubmit = studentName.trim() && subject.trim() && timezone && offeredRate > 0;

  async function handleSubmit() {
    if (!studentName.trim()) { setError('Student name is required'); return; }
    if (!subject.trim()) { setError('Subject is required'); return; }
    if (!timezone) { setError('Timezone is required'); return; }
    if (offeredRate < 5) { setError('Offered rate must be at least $5'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name:  studentName.trim(),
          student_email: studentEmail.trim() || null,
          subject:       subject.trim(),
          timezone,
          start_date:    startDate || null,
          end_date:      endDate || null,
          notes:         notes.trim() || null,
          offered_rate:  offeredRate,
          requested_schedule: tuples,
          session_duration_minutes: duration,
          sessions_per_week: frequency,
        }),
      });
      const body = await res.json() as { id?: string; error?: string };
      if (!res.ok) { setError(body.error ?? 'Failed to create request'); return; }
      const newRequest: TuitionRequest = {
        id:           body.id!,
        source:       'manual',
        status:       'open',
        studentName:  studentName.trim(),
        studentEmail: studentEmail.trim(),
        subject:      subject.trim(),
        subjectId:    subjects.find(s => s.name === subject.trim())?.id ?? '',
        tuples:       tuples,
        tz:           timezone,
        startDate:    startDate || '—',
        notes:        notes.trim(),
        receivedAt:   'Just now',
        offeredRate,
        sessionDurationMinutes: duration,
        sessionsPerWeek: frequency,
      };
      onCreate(newRequest);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div onClick={e => e.stopPropagation()} className="bg-surface-1 rounded-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto p-6 shadow-[0_16px_48px_rgba(22,32,51,0.20)]">
        <h2 className="text-base font-semibold text-fg-1 mb-4">New request</h2>

        <div className="flex flex-col gap-3">
          {/* Student name (required) */}
          <Field label="Student name *">
            <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
          </Field>

          {/* Student email (optional) */}
          <Field label="Student email">
            <input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="jane@example.com" className={inputCls} />
          </Field>

          {/* Subject (required) — searchable dropdown */}
          <Field label="Subject *">
            <div ref={subjectRef} className="relative">
              <input
                value={subjectOpen ? subjectSearch : subject}
                onChange={e => { setSubjectSearch(e.target.value); setSubjectOpen(true); if (!subjectOpen) setSubject(''); }}
                onFocus={() => { setSubjectOpen(true); setSubjectSearch(subject); }}
                placeholder="Search or type a subject…"
                className={inputCls}
              />
              {subjectOpen && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-surface-1 border border-border-default rounded-lg shadow-md max-h-48 overflow-y-auto">
                  {filteredSubjects.map(s => (
                    <button key={s.id} type="button" onClick={() => { setSubject(s.name); setSubjectOpen(false); setSubjectSearch(''); }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2 transition-colors text-fg-1">{s.name}</button>
                  ))}
                  {filteredSubjects.length === 0 && subjectSearch && (
                    <button type="button" onClick={() => { setSubject(subjectSearch); setSubjectOpen(false); setSubjectSearch(''); }}
                      className="w-full text-left px-3 py-2 text-[13px] text-fg-3 hover:bg-surface-2">Use "{subjectSearch}"</button>
                  )}
                </div>
              )}
            </div>
          </Field>

          {/* Offered rate — slider */}
          <Field label={`Offered rate · $${offeredRate}/hr`}>
            <input type="range" min={5} max={80} step={5} value={offeredRate} onChange={e => setOfferedRate(+e.target.value)}
              className="w-full h-2 rounded-full appearance-none bg-neutral-200 accent-brand-ink cursor-pointer" />
            <div className="flex justify-between text-[10px] text-fg-muted mt-1">
              <span>$5</span><span>$80</span>
            </div>
          </Field>

          {/* Session length + frequency */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Session length · ${duration}m`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setDuration(d => Math.max(15, d - 5))}
                  className={stepBtnCls}>−</button>
                <input type="number" value={duration} onChange={e => setDuration(Math.max(15, +e.target.value))}
                  className="flex-1 h-9 text-center border border-border-default rounded-lg text-[13px] text-fg-1 bg-surface-1 focus:outline-none focus:border-neutral-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <button type="button" onClick={() => setDuration(d => d + 5)}
                  className={stepBtnCls}>+</button>
              </div>
            </Field>
            <Field label={`Sessions / week · ${frequency}×`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setFrequency(f => Math.max(1, f - 1))}
                  className={stepBtnCls}>−</button>
                <div className="flex-1 h-9 flex items-center justify-center border border-border-default rounded-lg text-[13px] font-semibold text-fg-1 bg-surface-1">
                  {frequency}×
                </div>
                <button type="button" onClick={() => setFrequency(f => f + 1)}
                  className={stepBtnCls}>+</button>
              </div>
            </Field>
          </div>

          {/* Timezone (required) — searchable dropdown */}
          <Field label="Timezone *">
            <div ref={tzRef} className="relative">
              <input
                value={tzOpen ? tzSearch : formatTimezoneLabel(timezone)}
                onChange={e => { setTzSearch(e.target.value); setTzOpen(true); }}
                onFocus={() => { setTzOpen(true); setTzSearch(''); }}
                placeholder="Search timezones…"
                className={inputCls}
              />
              {tzOpen && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-surface-1 border border-border-default rounded-lg shadow-md max-h-48 overflow-y-auto">
                  {filteredTz.slice(0, 30).map(tz => (
                    <button key={tz} type="button" onClick={() => { setTimezone(tz); setTzOpen(false); setTzSearch(''); }}
                      className="w-full text-left px-3 py-2 text-[12px] hover:bg-surface-2 transition-colors text-fg-1">{formatTimezoneLabel(tz)}</button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {/* Start date + End date — calendar pickers */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={dateCls + (!startDate ? ' text-fg-muted' : '')} />
            </Field>
            <Field label="End date">
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={dateCls + (!endDate ? ' text-fg-muted' : '')} />
            </Field>
          </div>

          {/* Student availability windows */}
          <Field label="Student availability">
            <div className="flex gap-2 mb-2">
              <input
                value={availText}
                onChange={e => setAvailText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); parseAvailText(); } }}
                placeholder='e.g. "weekday evenings" or "Mon/Wed 4-8 PM"'
                className={inputCls}
              />
              <button type="button" onClick={parseAvailText}
                className="shrink-0 h-9 px-3 rounded-lg border border-border-default bg-surface-1 text-[12px] font-semibold text-fg-2 hover:bg-surface-2 transition-colors">
                Parse
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {tuples.map((t, i) => (
                <TupleRow key={i} tuple={t}
                  onChange={updated => setTuples(prev => prev.map((x, j) => j === i ? updated : x))}
                  onRemove={() => setTuples(prev => prev.filter((_, j) => j !== i))} />
              ))}
              {tuples.length < 7 && (
                <button type="button" onClick={() => setTuples(prev => [...prev, { day: 1, start: 16, end: 20 }])}
                  className="text-[11px] font-semibold text-brand-primary-ink hover:text-brand-primary-deep transition-colors self-start mt-1">
                  + Add window
                </button>
              )}
              {tuples.length === 0 && (
                <p className="text-[11px] text-fg-muted">No windows set. Type availability above or add manually.</p>
              )}
            </div>
          </Field>

          {/* Notes (optional) */}
          <Field label="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Any context about the student or request…"
              className="w-full px-3 py-2 border border-border-default rounded-lg text-[13px] text-fg-1 bg-surface-1 resize-y focus:outline-none focus:border-neutral-400 placeholder:text-fg-muted" />
          </Field>
        </div>

        {error && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">{error}</div>
        )}

        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-surface-2 text-fg-2 hover:bg-surface-3 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !canSubmit}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-brand-ink text-white hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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

const dateCls =
  inputCls + ' [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:cursor-pointer';

const stepBtnCls =
  'w-9 h-9 rounded-lg border border-border-default bg-surface-1 text-fg-1 text-[16px] font-semibold hover:bg-surface-2 transition-colors flex items-center justify-center shrink-0 cursor-pointer';
