import { Avatar } from '@/components/ui/Avatar';
import { formatResponseTime } from '@/lib/utils/responseTime';

export interface LeaderboardRow {
  tutorId:   string;
  tutorName: string;
  rank:      number | null;
  avgMs:     number;
  count:     number;
}

function tutorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export function ResponseTimeLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-[13px] text-fg-muted">No resolved proposals in the last 90 days.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, i) => (
        <div key={row.tutorId} className={`flex items-center gap-3 px-2 py-2 rounded-lg ${i % 2 === 0 ? 'bg-surface-2' : ''}`}>
          {/* Rank badge */}
          <div className="w-7 text-center shrink-0">
            {row.rank !== null ? (
              <span className="text-[13px] font-extrabold text-brand-primary-ink tabular-nums">#{row.rank}</span>
            ) : (
              <span className="text-[11px] text-fg-muted">—</span>
            )}
          </div>

          <Avatar initials={tutorInitials(row.tutorName)} size="sm" tone="brand" />

          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-fg-1 truncate">{row.tutorName}</div>
            <div className="text-[11px] text-fg-3">{row.count} proposal{row.count === 1 ? '' : 's'}</div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[14px] font-bold text-fg-1 tabular-nums">{formatResponseTime(row.avgMs)}</div>
            <div className="text-[10px] text-fg-muted">avg</div>
          </div>
        </div>
      ))}
    </div>
  );
}
