import Link from 'next/link';

interface AlertsStripProps {
  declined: number;
  expired: number;
  pendingReviews: number;
}

interface AlertItem {
  tone: 'warn' | 'info';
  text: string;
  action: string;
  href: string;
}

export function AlertsStrip({ declined, expired, pendingReviews }: AlertsStripProps) {
  const alerts: AlertItem[] = [];

  if (declined > 0) alerts.push({
    tone: 'warn',
    text: `${declined} tutor${declined === 1 ? '' : 's'} declined — student${declined === 1 ? '' : 's'} back in pool`,
    action: 'Rematch',
    href: '/dashboard/proposals',
  });
  if (expired > 0) alerts.push({
    tone: 'warn',
    text: `${expired} invitation${expired === 1 ? '' : 's'} expired without response`,
    action: 'Review',
    href: '/dashboard/proposals',
  });
  if (pendingReviews > 0) alerts.push({
    tone: 'info',
    text: `${pendingReviews} subject change request${pendingReviews === 1 ? '' : 's'} awaiting approval`,
    action: 'Review',
    href: '/dashboard/subjects',
  });

  if (alerts.length === 0) return null;

  return (
    <div className="bg-surface-1 border border-border-default rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border-default flex items-center gap-2">
        <div className="w-[22px] h-[22px] rounded-md bg-warning-bg inline-flex items-center justify-center shrink-0">
          <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 2L1 14h14L8 2z" stroke="#92400E" strokeWidth={1.5} strokeLinejoin="round" />
            <path d="M8 7v3M8 12v.5" stroke="#92400E" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="text-[13px] font-bold tracking-[-0.01em] text-fg-1">Alerts</h3>
        <span className="text-[10px] font-bold px-1.5 py-px rounded-full bg-warning-bg text-warning-ink">
          {alerts.length}
        </span>
      </div>

      {/* Alert rows */}
      <ul className="m-0 p-0 list-none">
        {alerts.map((a, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-4 py-2.5 border-t border-neutral-100 first:border-t-0"
          >
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                a.tone === 'warn' ? 'bg-warning' : 'bg-info'
              }`}
            />
            <div className="flex-1 text-xs font-medium text-fg-2">{a.text}</div>
            <Link
              href={a.href}
              className="h-[26px] px-2.5 rounded-md border border-border-default bg-surface-1 text-fg-1 text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-surface-2 hover:border-neutral-300 transition-colors shrink-0"
            >
              {a.action}
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 2l4 3-4 3" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
