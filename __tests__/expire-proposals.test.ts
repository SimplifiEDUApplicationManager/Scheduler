import { describe, it, expect } from 'vitest';
import { findExpiredProposals } from '@/lib/utils/expire-proposals';

interface PendingProposal {
  id: string;
  expires_at: string; // ISO 8601
}

const NOW = '2026-05-07T12:00:00.000Z';
const nowMs = new Date(NOW).getTime();

function makeProposal(id: string, expiresAt: string): PendingProposal {
  return { id, expires_at: expiresAt };
}

describe('findExpiredProposals', () => {
  it('returns empty array when given no proposals', () => {
    expect(findExpiredProposals([], nowMs)).toEqual([]);
  });

  it('returns a proposal whose expires_at is before now', () => {
    const proposals = [makeProposal('p1', '2026-05-07T11:59:59.999Z')];
    expect(findExpiredProposals(proposals, nowMs)).toEqual(['p1']);
  });

  it('does not return a proposal whose expires_at equals now exactly', () => {
    const proposals = [makeProposal('p1', NOW)];
    expect(findExpiredProposals(proposals, nowMs)).toEqual([]);
  });

  it('does not return a proposal whose expires_at is in the future', () => {
    const proposals = [makeProposal('p1', '2026-05-07T12:00:00.001Z')];
    expect(findExpiredProposals(proposals, nowMs)).toEqual([]);
  });

  it('returns only the expired proposals from a mixed list', () => {
    const proposals = [
      makeProposal('expired-1', '2026-05-06T10:00:00Z'),
      makeProposal('future-1',  '2026-05-08T10:00:00Z'),
      makeProposal('expired-2', '2026-05-07T11:59:59Z'),
      makeProposal('future-2',  '2026-05-09T00:00:00Z'),
    ];
    expect(findExpiredProposals(proposals, nowMs)).toEqual(['expired-1', 'expired-2']);
  });

  it('returns all proposals when all are expired', () => {
    const proposals = [
      makeProposal('p1', '2026-05-01T00:00:00Z'),
      makeProposal('p2', '2026-05-02T00:00:00Z'),
      makeProposal('p3', '2026-05-03T00:00:00Z'),
    ];
    expect(findExpiredProposals(proposals, nowMs)).toEqual(['p1', 'p2', 'p3']);
  });

  it('handles a proposal with expires_at far in the past', () => {
    const proposals = [makeProposal('p1', '2020-01-01T00:00:00Z')];
    expect(findExpiredProposals(proposals, nowMs)).toEqual(['p1']);
  });
});
