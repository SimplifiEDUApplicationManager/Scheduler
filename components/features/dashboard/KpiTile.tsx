import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface TrendInfo {
  dir: 'up' | 'down' | 'flat';
  text: string;
  warn?: boolean;
}

interface KpiTileProps {
  label: string;
  value: string | number;
  hint: string;
  trend?: TrendInfo;
  href?: string;
  accentColor: string;
}

function TrendArrow({ dir }: { dir: 'up' | 'down' }) {
  const d = dir === 'up' ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4';
  return (
    <svg
      width={10} height={10} viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const tileClass =
  'block w-full text-left rounded-xl p-4 bg-surface-1 border border-border-default ' +
  'hover:border-neutral-300 hover:shadow-sm transition-all duration-150';

export function KpiTile({ label, value, hint, trend, href, accentColor }: KpiTileProps) {
  const inner = (
    <>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] font-bold tracking-[0.06em] uppercase text-fg-3">{label}</div>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />
      </div>
      <div className="text-[32px] font-extrabold leading-none tracking-[-0.02em] text-fg-1 tabular-nums">
        {value}
      </div>
      <div className="text-[11px] text-fg-3 mt-2">{hint}</div>
      {trend && (
        <div
          className={cn(
            'mt-2.5 pt-2.5 border-t border-neutral-100 text-[11px] font-semibold inline-flex items-center gap-1',
            trend.warn
              ? 'text-warning-ink'
              : trend.dir === 'up'
              ? 'text-success-ink'
              : 'text-fg-3',
          )}
        >
          {(trend.dir === 'up' || trend.dir === 'down') && <TrendArrow dir={trend.dir} />}
          {trend.text}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={tileClass}>
        {inner}
      </Link>
    );
  }
  return <div className={tileClass}>{inner}</div>;
}
