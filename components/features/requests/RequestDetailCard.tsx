interface RequestDetailCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function RequestDetailCard({ title, subtitle, children }: RequestDetailCardProps) {
  return (
    <section className="bg-white border border-neutral-200 rounded-xl p-4.5">
      <div className="mb-3">
        <h3 className="text-[13px] font-bold text-fg-1">{title}</h3>
        {subtitle && <p className="text-[11px] text-fg-muted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
