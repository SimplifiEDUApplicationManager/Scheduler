import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TutorCalendarClient } from '@/components/features/tutor/TutorCalendarClient';
import { fetchTutorEvents, weekRange } from '@/lib/nylas/events';
import { getTutorProposals } from '@/lib/data/proposals';
import { TUTORS, TUTOR_EVENTS, TUTOR_PROPOSALS, ME_TUTOR_ID } from '@/lib/data/mock';
import { DEV_BYPASS } from '@/lib/env';
import type { Tutor } from '@/lib/types/domain';

export default async function TutorCalendarPage() {
  if (DEV_BYPASS) {
    const me = TUTORS.find(t => t.id === ME_TUTOR_ID) ?? TUTORS[0];
    return (
      <TutorCalendarClient
        me={me}
        initialEvents={TUTOR_EVENTS}
        initialProposals={TUTOR_PROPOSALS}
      />
    );
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('users')
    .select('id, name, email, timezone, nylas_grant_id, max_weekly_hours, min_weekly_hours')
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
    isPaused:     false,
    totalAvailabilityHours: 0,
    availabilityRequests:   [],
  };

  // Fetch this week's events from Nylas for the initial server render.
  // If the calendar isn't connected yet, initialEvents is empty and the
  // client will show the empty calendar state.
  const { startUnix, endUnix } = weekRange(0);
  const initialEvents = row.nylas_grant_id
    ? await fetchTutorEvents(row.nylas_grant_id, startUnix, endUnix, me.tz)
    : [];

  const initialProposals = await getTutorProposals(row.id, supabase);

  return (
    <TutorCalendarClient
      me={me}
      initialEvents={initialEvents}
      initialProposals={initialProposals}
    />
  );
}
