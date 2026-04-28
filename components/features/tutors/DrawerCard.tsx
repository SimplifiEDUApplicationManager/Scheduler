interface DrawerCardProps {
  title: string;
  children: React.ReactNode;
}

export function DrawerCard({ title, children }: DrawerCardProps) {
  return (
    <section className="bg-white border border-neutral-200 rounded-xl p-4">
      <h3 className="text-[12px] font-bold text-fg-1 mb-2.5">{title}</h3>
      {children}
    </section>
  );
}
