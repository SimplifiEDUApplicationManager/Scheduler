import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createTutoringEvent, tupleToUnix } from '@/lib/nylas/events';

/**
 * POST /api/proposals/demo/accept
 * Onboarding-only endpoint. Creates a practice [Tutoring] calendar event
 * for the authenticated tutor so they can see the full acceptance flow.
 * Gracefully skips event creation if the tutor has no calendar connected yet.
 */
export async function POST() {
  const auth = await requireActiveRole(['TUTOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { data: tutor } = await auth.supabase
    .from('users')
    .select('nylas_grant_id, email, meeting_link, timezone')
    .eq('id', auth.user.id)
    .single();

  if (!tutor?.nylas_grant_id) {
    // No calendar connected yet — still count as success for the tour
    return NextResponse.json({ ok: true, calendarConnected: false });
  }

  const tz = tutor.timezone ?? 'America/New_York';
  // Book next Tuesday 4–5 pm in the tutor's timezone as the demo session
  const { startUnix, endUnix } = tupleToUnix(2, 16, 17, tz, null);

  await createTutoringEvent(tutor.nylas_grant_id, {
    studentName:  'Demo Student',
    studentEmail: 'demo@simplifiedu.com',
    subject:      'Demo Session',
    startUnix,
    endUnix,
    meetingLink: tutor.meeting_link ?? undefined,
    calendarId:  tutor.email ?? undefined,
  });

  return NextResponse.json({ ok: true, calendarConnected: true });
}
