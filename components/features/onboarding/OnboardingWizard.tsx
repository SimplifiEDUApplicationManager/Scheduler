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

interface Props {
  initialName: string;
  email: string;
}

export function OnboardingWizard({ initialName, email }: Props) {
  const router = useRouter();
  const [step, setStep]           = useState<1 | 2>(1);
  const [name, setName]           = useState(initialName);
  const [timezone, setTimezone]   = useState('');
  const [minRate, setMinRate]     = useState<number>(25);
  const [maxHours, setMaxHours]   = useState<string>('20');
  const [meetingLink, setLink]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Step 1 validation ────────────────────────────────────────────────────
  function submitStep1(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!timezone) { setError('Please select your timezone'); return; }
    setError(null);
    setStep(2);
  }

  // ── Step 2 submit ────────────────────────────────────────────────────────
  async function submitStep2(e: FormEvent) {
    e.preventDefault();
    const hours = Number(maxHours);
    if (!Number.isInteger(hours) || hours < 6 || hours > 40) {
      setError('Max weekly hours must be between 6 and 40');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          timezone,
          minRate,
          maxWeeklyHours: hours,
          meetingLink: meetingLink.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        setSubmitting(false);
        return;
      }
      router.replace('/tutor/settings');
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const tzOptions = TIMEZONES.map(tz => ({
    value: tz,
    label: formatTimezoneLabel(tz),
  }));

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-2 p-6">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2] as const).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
              step >= s
                ? 'bg-brand-primary text-fg-on-brand'
                : 'bg-surface-3 text-fg-3',
            )}>
              {s}
            </div>
            {s < 2 && <div className={cn('w-12 h-0.5', step > s ? 'bg-brand-primary' : 'bg-border-default')} />}
          </div>
        ))}
      </div>

      <div className="bg-surface-1 rounded-2xl shadow-lg w-full max-w-md p-8">

        {/* ── Step 1: About you ─────────────────────────────────────────── */}
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
              placeholder="Select your timezone…"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              required
            />

            {error && <p className="text-xs text-danger-ink">{error}</p>}

            <Button type="submit" size="lg" className="w-full mt-1">
              Continue →
            </Button>

            <p className="text-xs text-fg-muted text-center">Signed in as {email}</p>
          </form>
        )}

        {/* ── Step 2: Preferences ───────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={submitStep2} className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-extrabold text-fg-1">Your preferences</h1>
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

            {/* Max hours */}
            <Input
              label="Max weekly hours"
              type="number"
              min={6}
              max={40}
              value={maxHours}
              onChange={e => setMaxHours(e.target.value)}
              hint="How many hours per week are you available to tutor? (6–40)"
              required
            />

            {/* Meeting link */}
            <Input
              label="Video conferencing link (optional)"
              type="url"
              placeholder="https://zoom.us/j/… or https://meet.google.com/…"
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
                disabled={submitting}
              >
                ← Back
              </Button>
              <Button type="submit" size="lg" className="flex-1" disabled={submitting}>
                {submitting ? 'Setting up…' : 'Complete setup'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
