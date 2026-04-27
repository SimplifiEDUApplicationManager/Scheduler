import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const variantClasses = {
  default: 'bg-surface-1 border border-border-default shadow-xs',
  elevated: 'bg-surface-1 shadow-md',
  brand: 'bg-surface-brand border border-brand-teal-200',
  flat: 'bg-surface-2',
} as const;

export type CardVariant = keyof typeof variantClasses;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl p-5', variantClasses[variant], className)}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('mb-4 flex items-start justify-between', className)} {...props}>
      {children}
    </div>
  ),
);
CardHeader.displayName = 'CardHeader';

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-h4 font-semibold text-fg-1', className)} {...props}>
      {children}
    </h3>
  ),
);
CardTitle.displayName = 'CardTitle';

export { Card, CardHeader, CardTitle };
