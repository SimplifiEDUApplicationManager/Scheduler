import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const toneClasses = {
  neutral: 'bg-neutral-200 text-neutral-600',
  brand: 'bg-surface-brand text-brand-primary-ink',
  cream: 'bg-surface-cream text-warning-ink',
  dark: 'bg-neutral-800 text-neutral-200',
} as const;

const sizeClasses = {
  sm: 'w-7 h-7 text-xxs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-body',
  xl: 'w-12 h-12 text-body-lg',
} as const;

export type AvatarTone = keyof typeof toneClasses;
export type AvatarSize = keyof typeof sizeClasses;

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  initials: string;
  tone?: AvatarTone;
  size?: AvatarSize;
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ initials, tone = 'neutral', size = 'md', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-full flex items-center justify-center font-bold tracking-wide shrink-0',
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
      aria-label={initials}
      {...props}
    >
      {initials}
    </div>
  ),
);
Avatar.displayName = 'Avatar';

export { Avatar };
