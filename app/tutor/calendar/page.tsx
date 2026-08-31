import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { TutorCalendarClient, type ResponseTimeStat } from '@/components/features/tutor/TutorCalendarClient';
import { fetchTutorEvents, weekRange } from '@/lib/nylas/events';
import { getTutorProposals } from '@/lib/data/proposals';
import { TUTORS, TUTOR_EVENTS, TUTOR_PROPOSALS, ME_TUTOR_ID } from '@/lib/data/mock';
import { DEV_BYPASS } from '@/lib/env';
import { computeLeaderboard } from '@/lib/utils/responseTime';
import type { Tutor } from '@/lib/types/domain';

export default async function TutorCalendarPage() {
  const emptyResponseTimeStat: ResponseTimeStat = { rank: null, avgMs: null, count: 0, totalRanked: 0 };

  if (DEV_BYPASS) {
    const me = TUTORS.find(t => t.id === ME_TUTOR_ID) ?? TUTORS[0];
    return (
      <TutorCalendarClient
        me={me}
        initialEvents={TUTOR_EVENTS}
        initialProposals={TUTOR_PROPOSALS}
        responseTimeStat={emptyResponseTimeStat}
      />
    );
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('users')
    .select('id, name, email, timezone, nylas_grant_id, selected_calendar_ids, max_weekly_hours, min_weekly_hours, min_rate')
    .eq('id', user.id)
    .single();

  if (!row) redirect('/login');

  // Build a minimal Tutor shape from the DB row.
  // Fields not yet stored in the DB fall back to safe defaults.
  const nameParts = (row.name ?? '').split(' ');
  const initials  = nameParts.map((p: string) => p[0] ?? '').join('').slice(0, 2).toUpperCase();

  const me: Tutor = {
    id:           row.id,
    initials,
    name:         row.name ?? '',
    email:        row.email ?? '',
    tz:           row.timezone ?? 'UTC',
    bio:          '',
    personality:  '',
    status:       'active',
    subjects:     [],
    availability: {},
    hoursCurrent: 0,
    hoursMax:     row.max_weekly_hours ?? 20,
    hoursMin:     row.min_weekly_hours ?? 6,
    minRate:      row.min_rate ?? 20,
    isPaused:     false,
    totalAvailabilityHours: 0,
    schedulingExceptions:   [],
    availabilityRequests:   [],
  };

  // Fetch this week's events and overrides from Nylas for the initial server render.
  const { startUnix, endUnix } = weekRange(0);

  const { data: overrideRows } = await supabase
    .from('event_overrides')
    .select('nylas_event_id, master_event_id, counted')
    .eq('user_id', row.id);

  const overrides = (overrideRows ?? []).map(o => ({
    nylas_event_id: o.nylas_event_id,
    master_event_id: o.master_event_id,
    counted: o.counted,
  }));

  let initialEvents = row.nylas_grant_id
    ? await fetchTutorEvents(row.nylas_grant_id, startUnix, endUnix, me.tz, overrides, (row.selected_calendar_ids as string[] | null)).catch(() => [])
    : [];

  // Compute current weekly hours from the already-fetched events (no extra API call).
  me.hoursCurrent = Math.round(
    initialEvents
      .filter(e => e.kind === 'session')
      .reduce((sum, e) => sum + Math.max(0, e.end - e.start), 0)
    * 100) / 100;

  const initialProposals = await getTutorProposals(row.id, supabase, true, row.timezone ?? undefined);

  // Use service client to see ALL tutors' proposals (RLS scopes the user client
  // to only this tutor's rows, which gives a misleading rank-1-of-1).
  const svc = createServiceClient();
  const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: resolvedProposals } = await svc
    .from('proposals')
    .select('tutor_id, created_at, resolved_at')
    .in('status', ['ACCEPTED', 'DECLINED', 'EXPIRED', 'TUTOR_ACCEPTED', 'CLIENT_DECLINED', 'FINISHED'])
    .not('resolved_at', 'is', null)
    .gte('created_at', windowStart);

  const leaderboard = computeLeaderboard(
    (resolvedProposals ?? [])
      .filter((p): p is typeof p & { tutor_id: string } => p.tutor_id !== null)
      .map(p => ({
        tutorId:    p.tutor_id,
        createdAt:  p.created_at,
        resolvedAt: p.resolved_at!,
      }))
  );
  const myEntry = leaderboard.get(row.id);
  const responseTimeStat: ResponseTimeStat = myEntry
    ? { rank: myEntry.rank, avgMs: myEntry.avgMs, count: myEntry.count, totalRanked: myEntry.totalRanked }
    : emptyResponseTimeStat;

  return (
    <TutorCalendarClient
      me={me}
      initialEvents={initialEvents}
      initialProposals={initialProposals}
      responseTimeStat={responseTimeStat}
    />
  );
}
