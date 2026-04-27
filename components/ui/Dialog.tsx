'use client';

import { useEffect, useCallback, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative bg-surface-1 rounded-xl shadow-xl w-full max-w-md',
          'animate-in fade-in zoom-in-95 duration-150',
          className,
        )}
      >
        {(title || description) && (
          <div className="px-6 pt-6 pb-4 border-b border-border-default">
            {title && <h2 className="text-h3 font-semibold text-fg-1">{title}</h2>}
            {description && <p className="mt-1 text-body text-fg-3">{description}</p>}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export type DialogActionsProps = HTMLAttributes<HTMLDivElement>;

export function DialogActions({ className, children, ...props }: DialogActionsProps) {
  return (
    <div className={cn('flex items-center justify-end gap-3 mt-6', className)} {...props}>
      {children}
    </div>
  );
}
