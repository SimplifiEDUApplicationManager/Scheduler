'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatTimezoneLabel } from '@/lib/utils/timezone';
import { RATE_OPTIONS } from '@/lib/utils/rate';
import { cn } from '@/lib/utils/cn';

// Curated timezone list covering the most common regions.
// Tutors can always update their timezone later in Settings.
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

// 0=Sun, 1=Mon ... 6=Sat (Nylas convention)
const DAYS = [
  { value: 1, label: 'M', full: 'Monday' },
  { value: 2, label: 'T', full: 'Tuesday' },
  { value: 3, label: 'W', full: 'Wednesday' },
  { value: 4, label: 'T', full: 'Thursday' },
  { value: 5, label: 'F', full: 'Friday' },
  { value: 6, label: 'S', full: 'Saturday' },
  { value: 0, label: 'S', full: 'Sunday' },
];

const CUSHION_OPTIONS = [0, 5, 10, 15, 20] as const;

function buildTimeOptions(startHour: number, endHour: number) {
  const options: { value: string; label: string }[] = [];
  for (let h = startHour; h <= endHour; h++) {
    const hh = String(h).padStart(2, '0');
    const suffix = h < 12 ? 'am' : 'pm';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    options.push({ value: `${hh}:00`, label: `${h12} ${suffix}` });
  }
  return options;
}

const START_OPTIONS = buildTimeOptions(6, 22);
const END_OPTIONS   = buildTimeOptions(7, 23);

interface Props {
  initialName: string;
  email: string;
}

export function OnboardingWizard({ initialName, email }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [name, setName]         = useState(initialName);
  const [timezone, setTimezone] = useState('');

  // Step 2
  const [minRate, setMinRate]   = useState<number>(25);
  const [minHours, setMinHours] = useState<string>('6');
  const [maxHours, setMaxHours] = useState<string>('20');
  const [meetingLink, setLink]  = useState('');

  // Step 3
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime]       = useState('09:00');
  const [endTime, setEndTime]           = useState('17:00');
  const [cushion, setCushion]           = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // -- Step 1 ----------------------------------------------------------------
  function submitStep1(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!timezone)    { setError('Please select your timezone'); return; }
    setError(null);
    setStep(2);
  }

  // -- Step 2 ----------------------------------------------------------------
  function submitStep2(e: FormEvent) {
    e.preventDefault();
    const max = Number(maxHours);
    const min = Number(minHours);
    if (!Number.isInteger(max) || max < 6 || max > 40) {
      setError('Max weekly hours must be between 6 and 40'); return;
    }
    if (!Number.isInteger(min) || min < 6 || min > max) {
      setError('Min weekly hours must be between 6 and max weekly hours'); return;
    }
    setError(null);
    setStep(3);
  }

  // -- Step 3 — save profile, advance to calendar step ----------------------
  async function submitStep3(e: FormEvent) {
    e.preventDefault();
    if (selectedDays.length === 0) {
      setError('Please select at least one working day'); return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time'); return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:           name.trim(),
          timezone,
          minRate,
          maxWeeklyHours: Number(maxHours),
          minWeeklyHours: Number(minHours),
          meetingLink:    meetingLink.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        setSubmitting(false);
        return;
      }
      setStep(4);
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  // -- Build Nylas auth URL encoding working hours + cushion in state --------
  function connectCalendar() {
    const openHours = [{ days: selectedDays, start: startTime, end: endTime }];
    const url = new URL('/api/nylas/auth', window.location.origin);
    url.searchParams.set('email', email);
    url.searchParams.set('open_hours', JSON.stringify(openHours));
    if (cushion > 0) url.searchParams.set('cushion', String(cushion));
    window.location.href = url.toString();
  }

  function toggleDay(day: number) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  }

  const tzOptions = TIMEZONES.map(tz => ({
    value: tz,
    label: formatTimezoneLabel(tz),
  }));

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-2 p-6">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3, 4] as const).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
              step >= s
                ? 'bg-brand-primary text-fg-on-brand'
                : 'bg-surface-3 text-fg-3',
            )}>
              {s}
            </div>
            {s < 4 && (
              <div className={cn('w-12 h-0.5', step > s ? 'bg-brand-primary' : 'bg-border-default')} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-surface-1 rounded-2xl shadow-lg w-full max-w-md p-8">

        {/* Step 1: About you */}
        {step === 1 && (
          <form onSubmit={submitStep1} className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-extrabold text-fg-1">Welcome to Simplifi EDU</h1>
              <p className="text-sm text-fg-3 mt-1">Let's get your profile set up. This takes about a minute.</p>
            </div>

            <Input
              label="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              required
            />

            <Select
              label="Your timezone"
              options={tzOptions}
              placeholder="Select your timezone..."
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              required
            />

            {error && <p className="text-xs text-danger-ink">{error}</p>}

            <Button type="submit" size="lg" className="w-full mt-1">
              Continue
            </Button>

            <p className="text-xs text-fg-muted text-center">Signed in as {email}</p>
          </form>
        )}

        {/* Step 2: Capacity */}
        {step === 2 && (
          <form onSubmit={submitStep2} className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-extrabold text-fg-1">Your capacity</h1>
              <p className="text-sm text-fg-3 mt-1">These help coordinators match you with the right students.</p>
            </div>

            {/* Min rate */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-fg-1">Minimum hourly rate</span>
              <div className="flex gap-2">
                {RATE_OPTIONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMinRate(r)}
                    className={cn(
                      'flex-1 h-9 rounded-md border text-body font-semibold transition-colors',
                      minRate === r
                        ? 'bg-brand-primary text-fg-on-brand border-brand-primary'
                        : 'bg-surface-1 text-fg-1 border-border-default hover:border-border-strong',
                    )}
                  >
                    ${r}
                  </button>
                ))}
              </div>
              <p className="text-xs text-fg-3">Coordinators won't propose students below this rate.</p>
            </div>

            {/* Min + max hours */}
            <div className="flex gap-3">
              <Input
                label="Min weekly hours"
                type="number"
                min={6}
                max={40}
                value={minHours}
                onChange={e => setMinHours(e.target.value)}
                hint="Minimum you'd like (6-40)"
                required
              />
              <Input
                label="Max weekly hours"
                type="number"
                min={6}
                max={40}
                value={maxHours}
                onChange={e => setMaxHours(e.target.value)}
                hint="Maximum you can take (6-40)"
                required
              />
            </div>

            {/* Meeting link */}
            <Input
              label="Video conferencing link (optional)"
              type="url"
              placeholder="https://zoom.us/j/... or https://meet.google.com/..."
              value={meetingLink}
              onChange={e => setLink(e.target.value)}
              hint="Added automatically to every session invite."
            />

            {error && <p className="text-xs text-danger-ink">{error}</p>}

            <div className="flex gap-3 mt-1">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => { setError(null); setStep(1); }}
              >
                Back
              </Button>
              <Button type="submit" size="lg" className="flex-1">
                Continue
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Availability */}
        {step === 3 && (
          <form onSubmit={submitStep3} className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-extrabold text-fg-1">Your availability</h1>
              <p className="text-sm text-fg-3 mt-1">When are you typically free to tutor? You can fine-tune this later.</p>
            </div>

            {/* Working days */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-fg-1">Working days</span>
              <div className="flex gap-1.5">
                {DAYS.map(({ value, label, full }) => (
                  <button
                    key={value}
                    type="button"
                    title={full}
                    onClick={() => toggleDay(value)}
                    className={cn(
                      'flex-1 h-9 rounded-md border text-xs font-bold transition-colors',
                      selectedDays.includes(value)
                        ? 'bg-brand-primary text-fg-on-brand border-brand-primary'
                        : 'bg-surface-1 text-fg-1 border-border-default hover:border-border-strong',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time window */}
            <div className="flex gap-3">
              <Select
                label="Start time"
                options={START_OPTIONS}
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                required
              />
              <Select
                label="End time"
                options={END_OPTIONS}
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                required
              />
            </div>

            {/* Session cushion */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-fg-1">Break between sessions</span>
              <div className="flex gap-2">
                {CUSHION_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCushion(c)}
                    className={cn(
                      'flex-1 h-9 rounded-md border text-xs font-semibold transition-colors',
                      cushion === c
                        ? 'bg-brand-primary text-fg-on-brand border-brand-primary'
                        : 'bg-surface-1 text-fg-1 border-border-default hover:border-border-strong',
                    )}
                  >
                    {c === 0 ? 'None' : `${c} min`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-fg-3">Buffer time blocked between back-to-back sessions.</p>
            </div>

            {error && <p className="text-xs text-danger-ink">{error}</p>}

            <div className="flex gap-3 mt-1">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => { setError(null); setStep(2); }}
                disabled={submitting}
              >
                Back
              </Button>
              <Button type="submit" size="lg" className="flex-1" disabled={submitting}>
                {submitting ? 'Saving...' : 'Continue'}
              </Button>
            </div>
          </form>
        )}

        {/* Step 4: Connect Calendar */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-extrabold text-fg-1">Connect your calendar</h1>
              <p className="text-sm text-fg-3 mt-1">
                Sync your Google or Outlook calendar so students can book sessions and
                coordinators can see your real availability.
              </p>
            </div>

            <div className="bg-surface-2 rounded-xl p-4 flex flex-col gap-1.5 text-sm text-fg-2">
              <p>Profile saved.</p>
              <p>
                Working hours and{' '}
                {cushion === 0 ? 'no session break' : `${cushion}-min break between sessions`}{' '}
                will be applied on connect.
              </p>
            </div>

            <Button type="button" size="lg" className="w-full" onClick={connectCalendar}>
              Connect Calendar
            </Button>

            <button
              type="button"
              className="text-xs text-fg-3 hover:text-fg-1 transition-colors text-center"
              onClick={() => router.replace('/tutor/settings')}
            >
              Skip for now — I'll connect later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
