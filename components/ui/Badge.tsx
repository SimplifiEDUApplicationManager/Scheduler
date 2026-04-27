import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const variantClasses = {
  default: 'bg-neutral-100 text-fg-2',
  brand: 'bg-surface-brand text-brand-primary-ink',
  success: 'bg-success-bg text-success-ink',
  warning: 'bg-warning-bg text-warning-ink',
  danger: 'bg-danger-bg text-danger-ink',
  info: 'bg-info-bg text-info-ink',
  // Coordinator confidence grades
  HIGH: 'bg-success-bg text-success-ink',
  MEDIUM: 'bg-warning-bg text-warning-ink',
  UNPROVEN: 'bg-neutral-100 text-fg-3',
  LOW: 'bg-danger-bg text-danger-ink',
} as const;

const sizeClasses = {
  xs: 'px-1.5 py-px text-xxs',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-body',
} as const;

export type BadgeVariant = keyof typeof variantClasses;
export type BadgeSize = keyof typeof sizeClasses;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'sm', className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center font-semibold rounded-xs tracking-wide whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  ),
);
Badge.displayName = 'Badge';

export { Badge };
