import type { TuitionRequest, Invitation, Tutor } from '@/lib/types/domain';

interface TimelineEvent {
  t: string;
  type: 'received' | 'proposed' | 'accepted' | 'declined' | 'expired' | 'matched';
  text: string;
  sub?: string;
}

const TYPE_STYLE: Record<TimelineEvent['type'], { bg: string; fg: string }> = {
  received: { bg: '#F5F5F5', fg: '#52525B' },
  proposed: { bg: '#FEF3C7', fg: '#92400E' },
  accepted: { bg: '#ECFDF5', fg: '#047857' },
  matched:  { bg: '#ECFDF5', fg: '#047857' },
  declined: { bg: '#FEF2F2', fg: '#991B1B' },
  expired:  { bg: '#F5F5F5', fg: '#71717A' },
};

interface Props {
  request: TuitionRequest;
  invitations: Invitation[];
  tutors: Tutor[];
  matchedTutor?: Tutor;
}

export function RequestTimeline({ request, invitations, tutors, matchedTutor }: Props) {
  const events: TimelineEvent[] = [
    {
      t: request.receivedAt,
      type: 'received',
      text: `Request received from ${request.source === 'asana' ? 'Asana' : 'manual intake'}`,
    },
  ];

  for (const inv of invitations) {
    const tutor = tutors.find(t => t.id === inv.tutorId);
    events.push({ t: inv.sentAt, type: 'proposed', text: `Proposed to ${tutor?.name ?? inv.tutorId}`, sub: `by ${inv.sentBy}` });
    if (inv.status === 'accepted') {
      events.push({ t: 'earlier today', type: 'accepted', text: `${tutor?.name ?? inv.tutorId} accepted`, sub: 'Student received calendar invite' });
    } else if (inv.status === 'declined') {
      events.push({ t: 'earlier', type: 'declined', text: `${tutor?.name ?? inv.tutorId} declined`, sub: inv.declineReason });
    } else if (inv.status === 'expired') {
      events.push({ t: inv.sentAt, type: 'expired', text: `${tutor?.name ?? inv.tutorId} — no response`, sub: 'Invitation expired' });
    }
  }
  if (matchedTutor) {
    events.push({ t: 'today', type: 'matched', text: `Matched with ${matchedTutor.name}`, sub: 'Tutoring underway' });
  }

  return (
    <ol className="flex flex-col gap-0 list-none p-0 m-0">
      {events.map((e, i) => {
        const { bg, fg } = TYPE_STYLE[e.type];
        return (
          <li key={i} className="grid gap-2.5 pb-3 relative" style={{ gridTemplateColumns: '28px 1fr' }}>
            {i < events.length - 1 && (
              <div className="absolute left-[13px] top-7 bottom-0 w-0.5 bg-neutral-100" />
            )}
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold z-10 shrink-0" style={{ background: bg, color: fg }}>
              {e.type === 'received' && '✉'}
              {e.type === 'proposed' && '→'}
              {(e.type === 'accepted' || e.type === 'matched') && '✓'}
              {e.type === 'declined' && '✕'}
              {e.type === 'expired' && '–'}
            </div>
            <div className="pt-1">
              <div className="text-[12px] font-semibold text-fg-1">{e.text}</div>
              {e.sub && <div className="text-[11px] text-fg-3 mt-0.5">{e.sub}</div>}
              <div className="text-[10px] text-fg-muted mt-0.5">{e.t}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
