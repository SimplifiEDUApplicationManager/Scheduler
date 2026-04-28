import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Tutor, Subject } from '@/lib/data/dashboard-mock';

interface PendingReviewListProps {
  tutors: Tutor[];
  subjects: Subject[];
}

export function PendingReviewList({ tutors, subjects }: PendingReviewListProps) {
  const pending: Array<{ tutor: Tutor; subjectName: string }> = [];

  for (const t of tutors) {
    for (const s of t.subjects) {
      if (s.conf === 'UNPROVEN') {
        const subj = subjects.find(x => x.id === s.id);
        pending.push({ tutor: t, subjectName: subj?.name ?? s.id });
      }
    }
  }

  if (pending.length === 0) {
    return (
      <div className="py-5 text-center">
        <p className="text-xs font-semibold text-fg-muted mt-1.5">All graded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {pending.slice(0, 4).map((p, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 bg-surface-2 rounded-lg">
          <Avatar initials={p.tutor.initials} size="sm" tone="brand" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-fg-1">{p.tutor.name.split(' ')[0]}</div>
            <div className="text-[10px] text-fg-3 mt-px">{p.subjectName}</div>
          </div>
          <Badge variant="UNPROVEN" size="xs">Unproven</Badge>
        </div>
      ))}
      {pending.length > 4 && (
        <p className="text-[11px] text-fg-muted pt-1">+{pending.length - 4} more</p>
      )}
    </div>
  );
}
