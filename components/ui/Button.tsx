import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const variantClasses = {
  primary:
    'bg-brand-primary text-fg-on-brand hover:bg-brand-primary-deep active:bg-brand-primary-ink',
  secondary:
    'bg-surface-3 text-fg-1 border border-border-default hover:bg-neutral-150 active:bg-neutral-200',
  ghost: 'bg-transparent text-fg-2 hover:bg-surface-3 active:bg-neutral-150',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-80',
} as const;

const sizeClasses = {
  sm: 'h-7 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-4 text-body rounded-md gap-2',
  lg: 'h-11 px-6 text-body-lg rounded-lg gap-2',
} as const;

export type ButtonVariant = keyof typeof variantClasses;
export type ButtonSize = keyof typeof sizeClasses;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export { Button };
