import type { Tutor, Invitation, InvitationStatus } from '@/lib/types/domain';

const STATUS_COLOR: Record<InvitationStatus, string> = {
  pending:  '#F59E0B',
  accepted: '#22C55E',
  declined: '#DC2626',
  expired:  '#A1A1AA',
};

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending:  'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  expired:  'Expired',
};

function StatusPill({ status }: { status: InvitationStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="text-[10px] font-bold px-2 py-px rounded-full whitespace-nowrap"
      style={{ background: `${color}20`, color }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

interface Props {
  tutor: Tutor;
  invitations: Invitation[];
}

export function TutorProfileHistory({ tutor, invitations }: Props) {
  const firstName = tutor.name.split(' ')[0];

  if (invitations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-8">
        <div className="text-[13px] font-semibold text-fg-2 mt-3">No invitations yet</div>
        <div className="text-[11px] text-fg-3 mt-1">
          When you propose {firstName} to a student, it&apos;ll show up here.
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-2">
      {invitations.map(inv => (
        <div
          key={inv.id}
          className="px-3.5 py-3 bg-white border border-neutral-200 rounded-xl"
          style={{ borderLeft: `3px solid ${STATUS_COLOR[inv.status]}` }}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-fg-1">{inv.studentName}</div>
              <div className="text-[11px] text-fg-3 mt-0.5">{inv.subject}</div>
            </div>
            <StatusPill status={inv.status} />
          </div>
          {inv.declineReason && (
            <div className="mt-2 px-2 py-1.5 bg-danger-bg rounded text-[11px] text-danger-ink italic leading-snug">
              &ldquo;{inv.declineReason}&rdquo;
            </div>
          )}
          <div className="mt-1.5 text-[10px] text-fg-muted">Sent {inv.sentAt}</div>
        </div>
      ))}
    </div>
  );
}
