import type { TuitionRequest, Tutor } from '@/lib/data/dashboard-mock';
import { cn } from '@/lib/utils/cn';

interface Props {
  request: TuitionRequest;
  selected: boolean;
  matchedTutor?: Tutor;
  onClick: () => void;
}

export function RequestListItem({ request: r, selected, matchedTutor, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'px-4 py-3 border-b border-neutral-100 cursor-pointer transition-colors border-l-[3px]',
        selected ? 'bg-brand-ink text-white' : 'hover:bg-surface-2',
      )}
      style={{
        borderLeftColor: selected ? '#3F9C8B' : r.status === 'open' ? '#F59E0B' : 'transparent',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className={cn('text-[13px] font-bold truncate', selected ? 'text-white' : 'text-fg-1')}>
          {r.studentName}
        </span>
        <span className={cn(
          'text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wide whitespace-nowrap shrink-0',
          selected
            ? r.status === 'open' ? 'bg-amber-900 text-amber-100' : 'bg-emerald-900 text-emerald-100'
            : r.status === 'open' ? 'bg-warning-bg text-warning-ink' : 'bg-success-bg text-success-ink',
        )}>
          {r.status}
        </span>
      </div>
      <div className={cn('text-[11px] truncate', selected ? 'text-neutral-300' : 'text-fg-2')}>
        {r.subject}
      </div>
      <div className={cn('text-[10px] flex items-center gap-1.5 mt-1', selected ? 'text-neutral-400' : 'text-fg-muted')}>
        <span className={cn(
          'px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wide',
          selected ? 'bg-neutral-700 text-neutral-300' : 'bg-surface-3 text-fg-3',
        )}>
          {r.source}
        </span>
        <span>·</span>
        <span>{r.receivedAt}</span>
      </div>
      {matchedTutor && (
        <div className={cn('text-[10px] font-semibold mt-1.5', selected ? 'text-teal-400' : 'text-success-ink')}>
          ✓ {matchedTutor.name}
        </div>
      )}
    </div>
  );
}
