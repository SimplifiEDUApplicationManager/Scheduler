import { Avatar } from '@/components/ui/Avatar';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { Tutor } from '@/lib/data/dashboard-mock';

interface TeamSnapshotProps {
  tutors: Tutor[];
}

export function TeamSnapshot({ tutors }: TeamSnapshotProps) {
  const sorted = [...tutors].sort(
    (a, b) => b.hoursCurrent / b.hoursMax - a.hoursCurrent / a.hoursMax,
  );

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.slice(0, 5).map(t => {
        const pct = Math.round((t.hoursCurrent / t.hoursMax) * 100);
        const pctColor =
          t.hoursCurrent >= t.hoursMax
            ? 'var(--danger)'
            : t.hoursCurrent / t.hoursMax >= 0.8
            ? 'var(--warning)'
            : 'var(--brand-teal-500)';

        return (
          <div
            key={t.id}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-2 transition-colors"
          >
            <Avatar initials={t.initials} size="sm" tone="brand" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-fg-1 truncate">{t.name}</div>
              <div className="text-[10px] text-fg-muted mt-px">
                {t.hoursCurrent}/{t.hoursMax}h this week
              </div>
            </div>
            <div className="w-16">
              <CapacityBar current={t.hoursCurrent} max={t.hoursMax} showLabel={false} />
            </div>
            <div
              className="text-[10px] font-bold w-7 text-right tabular-nums shrink-0"
              style={{ color: pctColor }}
            >
              {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
