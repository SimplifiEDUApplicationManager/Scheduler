// app/api/cron/weekly-summary/route.ts
// Triggered every Sunday at 7 PM ET (23:00 UTC) via Vercel Cron.
// Sends a weekly summary email to every active tutor.

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { nylasList } from '@/lib/nylas/client';
import { computeWeeklyHours, weekBounds } from '@/lib/utils/capacity';
import { sendWeeklySummaryEmail } from '@/lib/resend/emails';

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
    .select('id, email, name, max_weekly_hours, nylas_grant_id')
    .eq('role', 'TUTOR')
    .eq('status', 'ACTIVE');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { start, end } = weekBounds();
  const startSec = Math.floor(start / 1000);
  const endSec   = Math.floor(end   / 1000);

  const results = { sent: 0, skipped: 0, errors: 0 };

  for (const tutor of tutors ?? []) {
    try {
      // ── Hours this week via Nylas ──────────────────────────────────────────
      let hoursThisWeek = 0;
      if (tutor.nylas_grant_id) {
        const eventsResult = await nylasList<NylasEventRaw>(
          `/v3/grants/${tutor.nylas_grant_id}/events?start=${startSec}&end=${endSec}&limit=200&expand_recurring=true`,
        );
        if (eventsResult.ok) {
          const events = eventsResult.data
            .filter(e => e.when.object === 'timespan' && e.when.start_time != null && e.when.end_time != null)
            .map(e => ({
              title:      e.title ?? '',
              start_time: e.when.start_time!,
              end_time:   e.when.end_time!,
              metadata:   e.metadata ?? null,
            }));
          hoursThisWeek = computeWeeklyHours(events);
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
          maxWeeklyHours:  tutor.max_weekly_hours ?? 20,
          upcomingCount:   upcomingCount   ?? 0,
          proposalsPending: proposalsPending ?? 0,
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
