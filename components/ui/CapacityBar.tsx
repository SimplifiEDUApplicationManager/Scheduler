import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { capacityStatus } from '@/lib/utils/capacity';

const trackColors = {
  ok: 'bg-brand-teal-500',
  near: 'bg-warning',
  at: 'bg-danger',
} as const;

export interface CapacityBarProps extends HTMLAttributes<HTMLDivElement> {
  current: number;
  max: number;
  showLabel?: boolean;
}

const CapacityBar = forwardRef<HTMLDivElement, CapacityBarProps>(
  ({ current, max, showLabel = true, className, ...props }, ref) => {
    const pct = Math.min(100, Math.round((current / max) * 100));
    const status = capacityStatus(current, max);

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-semibold text-fg-2">{current}h</span>
            <span className="text-xxs text-fg-3">of {max}h</span>
          </div>
        )}
        <div className="h-1 w-full bg-surface-3 rounded-pill overflow-hidden">
          <div
            className={cn('h-full rounded-pill transition-all', trackColors[status])}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={max}
          />
        </div>
      </div>
    );
  },
);
CapacityBar.displayName = 'CapacityBar';

export { CapacityBar };
