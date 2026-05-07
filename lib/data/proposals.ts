// Proposal repository — state transitions for the Proposal lifecycle.
// All routes that mutate proposal status call these functions instead of writing inline queries.
//
// Valid transitions:
//   PENDING → ACCEPTED   (tutor accepts)
//   PENDING → DECLINED   (tutor declines, reason required)
//   PENDING → EXPIRED    (cron: TTL elapsed, no tutor response)
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
import { findExpiredProposals } from '@/lib/utils/expire-proposals';

type SupabaseInstance = ReturnType<typeof createServerClient<Database>>;

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
    .update({ status: 'ACCEPTED', resolved_at: new Date().toISOString() })
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
    .select('id, expires_at')
    .eq('status', 'PENDING');

  if (fetchError) throw fetchError;

  const expiredIds = findExpiredProposals(pending ?? [], nowMs);
  if (expiredIds.length === 0) return 0;

  const { error: updateError } = await supabase
    .from('proposals')
    .update({ status: 'EXPIRED', resolved_at: new Date().toISOString() })
    .in('id', expiredIds);

  if (updateError) throw updateError;
  return expiredIds.length;
}
