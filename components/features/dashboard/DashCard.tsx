import { ReactNode } from 'react';

interface DashCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function DashCard({ title, subtitle, action, children }: DashCardProps) {
  return (
    <section className="bg-surface-1 border border-border-default rounded-xl overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-border-default flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-bold tracking-[-0.01em] text-fg-1 m-0">{title}</h3>
          {subtitle && <div className="text-[11px] text-fg-muted mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
