import { forwardRef, SelectHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, error, hint, className, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold text-fg-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'h-9 w-full rounded-md border px-3 text-body text-fg-1 bg-surface-1',
            'outline-none transition-colors appearance-none cursor-pointer',
            'focus:border-border-brand focus:ring-2 focus:ring-brand-teal-100',
            error
              ? 'border-danger focus:border-danger focus:ring-danger-bg'
              : 'border-border-default hover:border-border-strong',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-3',
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${id}-error`} className="text-xs text-danger-ink">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${id}-hint`} className="text-xs text-fg-3">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
