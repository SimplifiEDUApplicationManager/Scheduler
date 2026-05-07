// Proposal expiry logic.
// Pure function — no Supabase dependency. Unit-tested in __tests__/expire-proposals.test.ts.

export interface ProposalExpiryCandiate {
  id: string;
  expires_at: string; // ISO 8601 timestamptz from Supabase
}

/**
 * Returns the IDs of proposals that have passed their TTL.
 * A proposal is expired when expires_at < nowMs (strictly before, not equal).
 */
export function findExpiredProposals(
  proposals: ProposalExpiryCandiate[],
  nowMs: number,
): string[] {
  return proposals
    .filter(p => new Date(p.expires_at).getTime() < nowMs)
    .map(p => p.id);
}
