export interface ProposalRow {
  tutorId: string;
  createdAt: string;
  resolvedAt: string;
}

export interface LeaderboardEntry {
  rank: number | null;
  avgMs: number;
  count: number;
  totalRanked: number;
}

export function formatResponseTime(ms: number): string {
  const mins = ms / 60_000;
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function computeLeaderboard(rows: ProposalRow[]): Map<string, LeaderboardEntry> {
  // Accumulate total ms and count per tutor
  const totals = new Map<string, { totalMs: number; count: number }>();
  for (const row of rows) {
    const ms = new Date(row.resolvedAt).getTime() - new Date(row.createdAt).getTime();
    const prev = totals.get(row.tutorId) ?? { totalMs: 0, count: 0 };
    totals.set(row.tutorId, { totalMs: prev.totalMs + ms, count: prev.count + 1 });
  }

  // Compute averages; only tutors with >= 3 proposals are eligible to rank
  const averages: { tutorId: string; avgMs: number }[] = [];
  for (const [tutorId, { totalMs, count }] of totals) {
    if (count >= 3) averages.push({ tutorId, avgMs: totalMs / count });
  }

  // Sort ascending (fastest first) and assign ranks (ties share rank)
  averages.sort((a, b) => a.avgMs - b.avgMs);
  const totalRanked = averages.length;
  const rankMap = new Map<string, number>();
  for (let i = 0; i < averages.length; i++) {
    const prev = averages[i - 1];
    const rank = prev && prev.avgMs === averages[i]!.avgMs ? rankMap.get(prev.tutorId)! : i + 1;
    rankMap.set(averages[i]!.tutorId, rank);
  }

  // Build output map for all tutors (including unranked)
  const result = new Map<string, LeaderboardEntry>();
  for (const [tutorId, { totalMs, count }] of totals) {
    result.set(tutorId, {
      rank:        rankMap.get(tutorId) ?? null,
      avgMs:       totalMs / count,
      count,
      totalRanked,
    });
  }
  return result;
}
