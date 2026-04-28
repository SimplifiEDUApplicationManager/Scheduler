import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils/cn';
import { AtRiskStudent } from '@/lib/data/dashboard-mock';

interface AtRiskListProps {
  items: AtRiskStudent[];
}

export function AtRiskList({ items }: AtRiskListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((s, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 bg-surface-2 rounded-lg border-l-[3px]',
            s.severity === 'high' ? 'border-l-[var(--danger)]' : 'border-l-[var(--warning)]',
          )}
        >
          <Avatar
            initials={s.name.split(' ').map(x => x[0]).join('')}
            size="sm"
            tone="cream"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-fg-1">
              {s.name}
              <span className="text-fg-muted font-medium"> · {s.subject} w/ {s.tutor}</span>
            </div>
            <div
              className={cn(
                'text-[11px] mt-px font-medium',
                s.severity === 'high' ? 'text-danger-ink' : 'text-warning-ink',
              )}
            >
              {s.reason}
            </div>
          </div>
          <button
            type="button"
            className="h-[26px] px-2.5 rounded-md bg-surface-1 border border-border-default text-[11px] font-semibold text-fg-1 inline-flex items-center hover:bg-surface-3 transition-colors shrink-0"
          >
            Open note
          </button>
        </div>
      ))}
    </div>
  );
}
