// app/api/cron/weekly-summary/route.ts
// Triggered every hour on Sundays (0 * * * 0) via Vercel Cron.
// Each run checks which tutors' local time is Sunday 19:xx and only sends to
// those tutors — so every tutor receives the email at 7 PM their own timezone.

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { nylasList } from '@/lib/nylas/client';
import { computeWeeklyHours, weekBounds } from '@/lib/utils/capacity';
import { sendWeeklySummaryEmail, type WeeklySession } from '@/lib/resend/emails';
import { toZonedTime } from 'date-fns-tz';

const appUrl = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

interface NylasEventRaw {
  title?: string;
  when: { object: string; start_time?: number; end_time?: number };
  metadata?: Record<string, string> | null;
}

export async function GET(req: Request) {
  // Vercel injects Authorization: Bearer {CRON_SECRET} on cron requests.
  // In production this keeps the endpoint from being triggered externally.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createServiceClient();

  const { data: tutors, error } = await supabase
    .from('users')
    .select('id, email, name, max_weekly_hours, nylas_grant_id, timezone')
    .eq('role', 'TUTOR')
    .eq('status', 'ACTIVE');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nowUtc = new Date();

  // Current ISO week (Mon–Sun) — used to compute hours tutor worked this week.
  const { start, end } = weekBounds(nowUtc.getTime());
  const startSec = Math.floor(start / 1000);
  const endSec   = Math.floor(end   / 1000);

  // Upcoming week (next Mon–Sun) — shown in the calendar grid.
  // Adding 7 days to a Sunday reference puts us firmly in next week.
  const { start: nextStart, end: nextEnd } = weekBounds(nowUtc.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextStartSec = Math.floor(nextStart / 1000);
  const nextEndSec   = Math.floor(nextEnd   / 1000);

  const results = { sent: 0, skipped: 0, errors: 0 };

  for (const tutor of tutors ?? []) {
    try {
      // ── Timezone gate: only send when it's Sunday 19:xx in the tutor's tz ──
      const tz = tutor.timezone ?? 'America/New_York';
      let localNow: Date;
      try {
        localNow = toZonedTime(nowUtc, tz);
      } catch {
        localNow = toZonedTime(nowUtc, 'America/New_York');
      }
      // getDay(): 0 = Sunday; getHours(): 19 = 7 PM
      if (localNow.getDay() !== 0 || localNow.getHours() !== 19) {
        results.skipped++;
        continue;
      }
      // ── Nylas events: current week (hours) + upcoming week (calendar) ────────
      let hoursThisWeek = 0;
      let weekSessions: WeeklySession[] = [];

      if (tutor.nylas_grant_id) {
        const [thisWeekResult, nextWeekResult] = await Promise.all([
          nylasList<NylasEventRaw>(
            `/v3/grants/${tutor.nylas_grant_id}/events?start=${startSec}&end=${endSec}&limit=200&expand_recurring=true`,
          ),
          nylasList<NylasEventRaw>(
            `/v3/grants/${tutor.nylas_grant_id}/events?start=${nextStartSec}&end=${nextEndSec}&limit=200&expand_recurring=true`,
          ),
        ]);

        if (thisWeekResult.ok) {
          const events = thisWeekResult.data
            .filter(e => e.when.object === 'timespan' && e.when.start_time != null && e.when.end_time != null)
            .map(e => ({
              title:      e.title ?? '',
              start_time: e.when.start_time!,
              end_time:   e.when.end_time!,
              metadata:   e.metadata ?? null,
            }));
          hoursThisWeek = computeWeeklyHours(events);
        }

        if (nextWeekResult.ok) {
          weekSessions = nextWeekResult.data
            .filter(e =>
              e.when.object === 'timespan' &&
              e.when.start_time != null &&
              e.when.end_time != null &&
              // Only include platform-created sessions, not personal calendar events.
              (e.metadata?.simplifi_created === 'true' || (e.title ?? '').startsWith('[Tutoring]')),
            )
            .map(e => ({
              title:        e.title?.replace(/^\[Tutoring\]\s*/, '') ?? 'Session',
              startTimeSec: e.when.start_time!,
              endTimeSec:   e.when.end_time!,
            }));
        }
      }

      // ── Proposal counts ───────────────────────────────────────────────────
      const [{ count: upcomingCount }, { count: proposalsPending }] = await Promise.all([
        supabase
          .from('proposals')
          .select('*', { count: 'exact', head: true })
          .eq('tutor_id', tutor.id)
          .eq('status', 'ACCEPTED'),
        supabase
          .from('proposals')
          .select('*', { count: 'exact', head: true })
          .eq('tutor_id', tutor.id)
          .eq('status', 'PENDING'),
      ]);

      // ── Send email ────────────────────────────────────────────────────────
      if (!appUrl) { results.skipped++; continue; }

      const name   = tutor.name ?? tutor.email.split('@')[0];
      const result = await sendWeeklySummaryEmail(
        tutor.email,
        name,
        {
          hoursThisWeek,
          maxWeeklyHours:   tutor.max_weekly_hours ?? 20,
          upcomingCount:    upcomingCount    ?? 0,
          proposalsPending: proposalsPending ?? 0,
          weekSessions,
          weekStartMs:      nextStart,
          tutorTimezone:    tz,
        },
        appUrl,
      );

      if (result.ok) {
        results.sent++;
      } else {
        results.errors++;
        console.error(`[weekly-summary] email failed for ${tutor.email}:`, result.error);
      }
    } catch (err) {
      results.errors++;
      console.error(`[weekly-summary] error for tutor ${tutor.id}:`, err);
    }
  }

  return NextResponse.json(results);
}
