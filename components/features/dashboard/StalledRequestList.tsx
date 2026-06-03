import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';

export interface StalledRequest {
  id: string;
  studentName: string;
  subject: string | null;
  source: string;
  createdAt: string;
}

function fmtAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 48) return `${hours}h open`;
  const days = Math.floor(hours / 24);
  return `${days}d open`;
}

export function StalledRequestList({ items }: { items: StalledRequest[] }) {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs font-semibold text-fg-muted">No stalled requests</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.slice(0, 4).map(req => (
        <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 rounded-lg">
          <Avatar
            initials={req.studentName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            size="sm"
            tone="cream"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-fg-1 truncate">
              {req.studentName}{req.subject ? ` · ${req.subject}` : ''}
            </div>
            <div className="text-[11px] text-fg-3 mt-px">
              {fmtAge(req.createdAt)} · {req.source === 'asana' ? 'from Asana' : 'manual'}
            </div>
          </div>
          <Link
            href="/dashboard/requests"
            className="h-[26px] px-2.5 rounded-md bg-surface-1 border border-border-default text-[11px] font-semibold text-fg-1 inline-flex items-center hover:bg-surface-3 transition-colors shrink-0"
          >
            Match
          </Link>
        </div>
      ))}
      {items.length > 4 && (
        <Link
          href="/dashboard/requests"
          className="text-[11px] font-semibold text-brand-primary-ink pt-2 hover:text-brand-primary-deep transition-colors"
        >
          + {items.length - 4} more →
        </Link>
      )}
    </div>
  );
}
