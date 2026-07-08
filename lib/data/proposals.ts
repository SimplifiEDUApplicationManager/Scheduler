// Proposal repository — reads and state transitions for the Proposal lifecycle.
// All routes that read or mutate proposals go through this module.
//
// Valid transitions:
//   PENDING → TUTOR_ACCEPTED   (tutor accepts, awaiting client approval)
//   PENDING → DECLINED         (tutor declines, reason required)
//   PENDING → EXPIRED          (cron: TTL elapsed, no tutor response)
//   TUTOR_ACCEPTED → ACCEPTED  (coordinator confirms after client approves)
//   TUTOR_ACCEPTED → CLIENT_DECLINED (coordinator rejects after client declines)
//   ACCEPTED → FINISHED        (tutor marks job complete)
//
// Design decisions:
//   - Caller passes the Supabase client (same pattern as lib/data/tutors.ts).
//   - Functions return a typed TransitionResult union so routes can map error codes to HTTP
//     status without try/catch or string matching.
//   - acceptProposal and declineProposal enforce tutor ownership: a proposal belonging to a
//     different tutor returns { ok: false, code: 'not_found' } — no information leakage.
//   - expireOverdueProposals is a high-level function used by the cron route: it fetches,
//     filters, and bulk-updates in one call.

import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';
import type { TutorProposal } from '@/lib/types/domain';
import { findExpiredProposals } from '@/lib/utils/expire-proposals';
import { convertTupleTimezone } from '@/lib/utils/timezone';

type SupabaseInstance = ReturnType<typeof createServerClient<Database>>;

// ── Private helpers ──────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sentAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all proposals for a tutor, newest first, mapped to TutorProposal.
 * Ownership is enforced by the .eq('tutor_id', tutorId) filter — a tutor can
 * only ever see their own proposals.
 */
export async function getTutorProposals(
  tutorId: string,
  supabase: SupabaseInstance,
  pendingOnly = true,
  tutorTz?: string,
): Promise<TutorProposal[]> {
  let query = supabase
    .from('proposals')
    .select('*, coordinator:users!proposals_coordinator_id_fkey(name, email)')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false });

  if (pendingOnly) query = query.eq('status', 'PENDING');

  const { data: rows, error } = await query;

  if (error) throw error;

  return (rows ?? []).map(row => {
    const coord    = row.coordinator as { name: string; email: string } | null;
    const rawSchedule = (row.requested_schedule ?? []) as { day: number; start: number; end: number }[];
    const requestTz = row.timezone;
    // Convert tuples to the tutor's timezone so the calendar shows correct local times
    const schedule = tutorTz && requestTz && tutorTz !== requestTz
      ? rawSchedule.map(t => convertTupleTimezone(t, requestTz, tutorTz))
      : rawSchedule;
    return {
      id:               row.id,
      studentName:      row.student_name,
      studentEmail:     row.student_email,
      subject:          row.subject,
      tuples:           schedule,
      tz:               tutorTz ?? requestTz,
      startDate:        formatDate(row.start_date),
      hoursPerWeek:     0,
      notes:            row.notes ?? '',
      coordinator:      coord?.name ?? 'Coordinator',
      coordinatorEmail: coord?.email ?? undefined,
      sentAt:           sentAgo(row.created_at),
      status:           row.status.toLowerCase() as TutorProposal['status'],
      declineReason:    row.decline_reason ?? undefined,
      offeredRate:      row.offered_rate ?? undefined,
      sessionDurationMinutes: row.session_duration_minutes ?? 60,
      sessionsPerWeek: row.sessions_per_week ?? 1,
      studentGrade:     row.student_grade ?? undefined,
      parentName:       row.parent_name ?? undefined,
      testName:         row.test_name ?? undefined,
      startingScore:    row.starting_score ?? undefined,
      goalScore:        row.goal_score ?? undefined,
      testDates:        row.test_dates ?? undefined,
      accommodations:   row.accommodations ?? undefined,
      scheduleNotes:    row.schedule_notes ?? undefined,
      wasUpdated:       row.status === 'PENDING' && row.resolved_at !== null,
    };
  });
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; code: 'not_found' | 'already_resolved' | 'db_error'; message: string };

/** Tutor accepts a pending proposal addressed to them. */
export async function acceptProposal(
  id: string,
  tutorId: string,
  supabase: SupabaseInstance,
): Promise<TransitionResult> {
  const { data: existing } = await supabase
    .from('proposals')
    .select('id, status')
    .eq('id', id)
    .eq('tutor_id', tutorId)
    .single();

  if (!existing) return { ok: false, code: 'not_found', message: 'Proposal not found' };
  if (existing.status !== 'PENDING') {
    return { ok: false, code: 'already_resolved', message: 'Proposal is already resolved' };
  }

  const { error } = await supabase
    .from('proposals')
    .update({ status: 'TUTOR_ACCEPTED', resolved_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, code: 'db_error', message: error.message };
  return { ok: true };
}

/** Tutor declines a pending proposal addressed to them. A reason is required. */
export async function declineProposal(
  id: string,
  tutorId: string,
  reason: string,
  supabase: SupabaseInstance,
): Promise<TransitionResult> {
  const { data: existing } = await supabase
    .from('proposals')
    .select('id, status')
    .eq('id', id)
    .eq('tutor_id', tutorId)
    .single();

  if (!existing) return { ok: false, code: 'not_found', message: 'Proposal not found' };
  if (existing.status !== 'PENDING') {
    return { ok: false, code: 'already_resolved', message: 'Proposal is already resolved' };
  }

  const { error } = await supabase
    .from('proposals')
    .update({
      status:         'DECLINED',
      decline_reason: reason,
      resolved_at:    new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { ok: false, code: 'db_error', message: error.message };
  return { ok: true };
}

const RESULT_STATUS: Record<'not_found' | 'already_resolved' | 'db_error', number> = {
  not_found:        404,
  already_resolved: 409,
  db_error:         500,
};

/** Map a failed TransitionResult to its HTTP status code. */
export function transitionHttpStatus(result: Extract<TransitionResult, { ok: false }>): number {
  return RESULT_STATUS[result.code];
}

/**
 * Expire all PENDING proposals whose TTL has elapsed.
 * Fetches candidates, filters by nowMs, bulk-updates to EXPIRED.
 * Returns the count of proposals expired.
 */
export async function expireOverdueProposals(
  supabase: SupabaseInstance,
  nowMs: number = Date.now(),
): Promise<number> {
  const { data: pending, error: fetchError } = await supabase
    .from('proposals')
    .select('id, expires_at, request_id')
    .eq('status', 'PENDING');

  if (fetchError) throw fetchError;

  const expiredIds = findExpiredProposals(pending ?? [], nowMs);
  if (expiredIds.length === 0) return 0;

  // Expire each proposal individually so we can:
  //   1. Set resolved_at = expires_at (exactly 24h) for accurate response-time scoring
  //   2. Reopen the linked request so coordinators can reassign
  let count = 0;
  for (const id of expiredIds) {
    const row = (pending ?? []).find(p => p.id === id);
    if (!row) continue;

    const { error: updateError } = await supabase
      .from('proposals')
      .update({ status: 'EXPIRED', resolved_at: row.expires_at })
      .eq('id', id);

    if (updateError) {
      console.error('[expire-proposals] failed to expire:', id, updateError.message);
      continue;
    }
    count++;

    if (row.request_id) {
      const { error: reqErr } = await supabase
        .from('requests')
        .update({ status: 'open', matched_proposal_id: null })
        .eq('id', row.request_id);
      if (reqErr) console.error('[expire-proposals] failed to reopen request:', row.request_id, reqErr.message);
    }
  }

  return count;
}
