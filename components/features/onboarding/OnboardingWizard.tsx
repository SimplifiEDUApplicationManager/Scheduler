'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { WorkingHoursEditor } from '@/components/features/tutor/WorkingHoursEditor';
import type { HoursMap } from '@/lib/types/scheduler';
import { EMPTY_HOURS_MAP } from '@/lib/types/scheduler';
import { formatTimezoneLabel } from '@/lib/utils/timezone';
import { cn } from '@/lib/utils/cn';

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


// Day key -> Nylas day number (0=Sun, 1=Mon ... 6=Sat)
const DAY_NUM: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

// Default Mon-Fri 9am-5pm, matching the settings page default.
const DEFAULT_HOURS: HoursMap = {
  ...EMPTY_HOURS_MAP,
  mon: [{ start: '09:00', end: '17:00' }],
  tue: [{ start: '09:00', end: '17:00' }],
  wed: [{ start: '09:00', end: '17:00' }],
  thu: [{ start: '09:00', end: '17:00' }],
  fri: [{ start: '09:00', end: '17:00' }],
};

interface Props {
  initialName: string;
  email: string;
}

export function OnboardingWizard({ initialName, email }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [name, setName]               = useState(initialName);
  const [timezone, setTimezone]       = useState('');
  const defaultPassword = (initialName.trim().split(/\s+/)[0] ?? '') + '1234';
  const [password, setPassword]       = useState(defaultPassword);
  const [confirmPassword, setConfirm] = useState(defaultPassword);

  // Step 2
  const [minHours, setMinHours] = useState<string>('6');
  const [maxHours, setMaxHours] = useState<string>('20');
  const [meetingLink, setLink]  = useState('');

  // Step 3
  const [hours, setHours]       = useState<HoursMap>({ ...DEFAULT_HOURS });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // -- Step 1 ----------------------------------------------------------------
  function submitStep1(e: FormEvent) {
    e.preventDefault();
    if (!name.trim())    { setError('Name is required'); return; }
    if (!timezone)       { setError('Please select your timezone'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
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

  // -- Step 3 — validate hours, save profile, advance to calendar step -------
  async function submitStep3(e: FormEvent) {
    e.preventDefault();

    const hasAnyWindow = Object.values(hours).some(ws => ws.length > 0);
    if (!hasAnyWindow) {
      setError('Please set at least one available time window'); return;
    }
    for (const [day, windows] of Object.entries(hours)) {
      for (const w of windows) {
        if (w.start >= w.end) {
          setError(`End time must be after start time on ${day.charAt(0).toUpperCase() + day.slice(1)}`);
          return;
        }
        // Check for overlapping windows on the same day
        const others = windows.filter(x => x !== w);
        for (const other of others) {
          if (w.start < other.end && other.start < w.end) {
            setError(`Overlapping time windows on ${day.charAt(0).toUpperCase() + day.slice(1)}`);
            return;
          }
        }
      }
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
          maxWeeklyHours: Number(maxHours),
          minWeeklyHours: Number(minHours),
          meetingLink:    meetingLink.trim() || null,
          password,
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

  // -- Build Nylas auth URL encoding per-day windows + cushion in state ------
  function connectCalendar() {
    // Convert HoursMap to OAuthOpenHours[] — one entry per day+window pair.
    const openHours = Object.entries(hours).flatMap(([key, windows]) =>
      windows.map(w => ({ days: [DAY_NUM[key]!], start: w.start, end: w.end })),
    ).filter(e => e.days[0] !== undefined);

    const url = new URL('/api/nylas/auth', window.location.origin);
    url.searchParams.set('email', email);
    if (openHours.length > 0) url.searchParams.set('open_hours', JSON.stringify(openHours));
    window.location.href = url.toString();
  }

  const tzOptions = TIMEZONES.map(tz => ({
    value: tz,
    label: formatTimezoneLabel(tz),
  }));

  const activeDayCount = Object.values(hours).filter(ws => ws.length > 0).length;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-2 p-6">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3, 4] as const).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
              step >= s ? 'bg-brand-primary text-fg-on-brand' : 'bg-surface-3 text-fg-3',
            )}>
              {s}
            </div>
            {s < 4 && (
              <div className={cn('w-12 h-0.5', step > s ? 'bg-brand-primary' : 'bg-border-default')} />
            )}
          </div>
        ))}
      </div>

      <div className={cn("bg-surface-1 rounded-2xl shadow-lg w-full p-8", step === 3 ? "max-w-xl" : "max-w-md")}>

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

            <Input
              label="Create a password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={e => setConfirm(e.target.value)}
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
              <Button type="button" variant="secondary" size="lg" className="flex-1"
                onClick={() => { setError(null); setStep(1); }}>
                Back
              </Button>
              <Button type="submit" size="lg" className="flex-1">Continue</Button>
            </div>
          </form>
        )}

        {/* Step 3: Availability */}
        {step === 3 && (
          <form onSubmit={submitStep3} className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-extrabold text-fg-1">Your availability</h1>
              <p className="text-sm text-fg-3 mt-1">Set your weekly working hours. You can add multiple windows per day.</p>
            </div>

            <WorkingHoursEditor hours={hours} onChange={setHours} />

            {error && <p className="text-xs text-danger-ink">{error}</p>}

            <div className="flex gap-3 mt-1">
              <Button type="button" variant="secondary" size="lg" className="flex-1"
                onClick={() => { setError(null); setStep(2); }} disabled={submitting}>
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
                {activeDayCount} day{activeDayCount !== 1 ? 's' : ''} of availability will be applied on connect.
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
