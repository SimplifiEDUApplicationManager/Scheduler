import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Invitation, Tutor } from '@/lib/data/dashboard-mock';

interface AttentionItem {
  kind: 'pending' | 'declined' | 'expired';
  invite: Invitation;
  tutor: Tutor | undefined;
}

function attentionReason(it: AttentionItem): string {
  if (it.kind === 'pending') return `Pending for ${it.invite.sentAt} · reminder queued`;
  if (it.kind === 'declined') return `Declined: ${it.invite.declineReason ?? 'no reason given'}`;
  return `Expired without response · ${it.invite.sentAt}`;
}

interface AttentionListProps {
  pending: Invitation[];
  declined: Invitation[];
  expired: Invitation[];
  tutors: Tutor[];
}

export function AttentionList({ pending, declined, expired, tutors }: AttentionListProps) {
  const items: AttentionItem[] = [
    ...pending.map(i => ({ kind: 'pending' as const, invite: i, tutor: tutors.find(t => t.id === i.tutorId) })),
    ...declined.map(i => ({ kind: 'declined' as const, invite: i, tutor: tutors.find(t => t.id === i.tutorId) })),
    ...expired.map(i => ({ kind: 'expired' as const, invite: i, tutor: tutors.find(t => t.id === i.tutorId) })),
  ];

  if (items.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs font-semibold text-fg-muted">All caught up</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.slice(0, 4).map((it, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 rounded-lg">
          <Avatar initials={it.tutor?.initials ?? '?'} size="sm" tone="brand" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-fg-1 truncate">
              {it.tutor?.name} → {it.invite.studentName}
            </div>
            <div className="text-[11px] text-fg-3 mt-px">{attentionReason(it)}</div>
          </div>
          <Link
            href="/dashboard/proposals"
            className="h-[26px] px-2.5 rounded-md bg-surface-1 border border-border-default text-[11px] font-semibold text-fg-1 inline-flex items-center hover:bg-surface-3 transition-colors shrink-0"
          >
            {it.kind === 'pending' ? 'Nudge' : 'Rematch'}
          </Link>
        </div>
      ))}
      {items.length > 4 && (
        <Link
          href="/dashboard/proposals"
          className="text-[11px] font-semibold text-brand-primary-ink pt-2 hover:text-brand-primary-deep transition-colors"
        >
          + {items.length - 4} more →
        </Link>
      )}
    </div>
  );
}
