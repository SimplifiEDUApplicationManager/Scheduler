import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendProposalEmail } from '@/lib/resend/emails';
import type { Json } from '@/lib/types/database';
import { isValidRate } from '@/lib/utils/rate';

const appUrl = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

/**
 * POST /api/proposals
 * Coordinator creates a proposal for a tutor.
 * Body: { tutor_id, student_name, student_email, subject, requested_schedule, timezone, start_date?, notes?,
 *         asana_task_id?, offered_rate?, student_grade?, parent_name?, test_name?, starting_score?,
 *         goal_score?, test_dates?, accommodations?, schedule_notes? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const body = await req.json() as Record<string, unknown>;
  const {
    tutor_id, student_name, student_email, subject,
    requested_schedule, timezone, start_date, notes, asana_task_id, offered_rate,
    student_grade, parent_name, test_name, starting_score, goal_score,
    test_dates, accommodations, schedule_notes, request_id,
  } = body;

  if (!tutor_id || !student_name || !student_email || !subject || !requested_schedule || !timezone) {
    return NextResponse.json({ error: 'Missing required fields', status: 400 }, { status: 400 });
  }

  if (offered_rate != null && !isValidRate(offered_rate)) {
    return NextResponse.json({ error: 'offered_rate must be 20, 25, 30, 35, or 40', status: 422 }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      tutor_id:           tutor_id as string,
      coordinator_id:     user.id,
      student_name:       student_name as string,
      student_email:      student_email as string,
      subject:            subject as string,
      requested_schedule: requested_schedule as Json,
      timezone:           timezone as string,
      start_date:         (start_date as string | undefined) ?? null,
      notes:              (notes as string | undefined) ?? null,
      asana_task_id:      (asana_task_id as string | undefined) ?? null,
      offered_rate:       isValidRate(offered_rate) ? offered_rate : null,
      student_grade:      (student_grade as string | undefined) ?? null,
      parent_name:        (parent_name as string | undefined) ?? null,
      test_name:          (test_name as string | undefined) ?? null,
      starting_score:     (starting_score as number | undefined) ?? null,
      goal_score:         (goal_score as number | undefined) ?? null,
      test_dates:         (test_dates as string | undefined) ?? null,
      accommodations:     (accommodations as string | undefined) ?? null,
      schedule_notes:     (schedule_notes as string | undefined) ?? null,
      request_id:         (request_id as string | undefined) ?? null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  // Mark the linked request as "proposed" so it leaves the open queue
  if (request_id) {
    const serviceClient = createServiceClient();
    await serviceClient
      .from('requests')
      .update({ status: 'proposed', matched_proposal_id: data.id })
      .eq('id', request_id as string);
  }

  // Send proposal notification email to tutor (fire-and-forget — don't fail the request if email fails)
  if (appUrl) {
    const serviceClient = createServiceClient();
    const [{ data: tutor }, { data: coordinator }] = await Promise.all([
      serviceClient.from('users').select('email, name').eq('id', tutor_id as string).single(),
      serviceClient.from('users').select('name').eq('id', user.id).single(),
    ]);

    if (tutor) {
      const coordName = coordinator?.name ?? 'Your coordinator';
      sendProposalEmail(
        tutor.email,
        tutor.name ?? tutor.email.split('@')[0],
        coordName,
        {
          studentName:  student_name as string,
          subject:      subject as string,
          schedule:     requested_schedule as Array<{ day: number; start: number; end: number }>,
          timezone:     timezone as string,
          startDate:    (start_date as string | undefined) ?? null,
          notes:        (notes as string | undefined) ?? null,
          offeredRate:  isValidRate(offered_rate) ? (offered_rate as number) : null,
        },
        appUrl,
      ).then(result => {
        if (!result.ok) console.error('[proposals] proposal email failed:', result.error);
      }).catch(err => {
        console.error('[proposals] proposal email threw:', err);
      });
    }
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
