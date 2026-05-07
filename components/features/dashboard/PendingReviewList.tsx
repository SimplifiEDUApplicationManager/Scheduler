import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

export interface PendingReviewItem {
  tutorName: string;
  tutorInitials: string;
  subjectName: string;
}

interface PendingReviewListProps {
  items: PendingReviewItem[];
}

export function PendingReviewList({ items }: PendingReviewListProps) {
  if (items.length === 0) {
    return (
      <div className="py-5 text-center">
        <p className="text-xs font-semibold text-fg-muted mt-1.5">All graded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.slice(0, 4).map((p, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 bg-surface-2 rounded-lg">
          <Avatar initials={p.tutorInitials} size="sm" tone="brand" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-fg-1">{p.tutorName.split(' ')[0]}</div>
            <div className="text-[10px] text-fg-3 mt-px">{p.subjectName}</div>
          </div>
          <Badge variant="UNPROVEN" size="xs">Unproven</Badge>
        </div>
      ))}
      {items.length > 4 && (
        <p className="text-[11px] text-fg-muted pt-1">+{items.length - 4} more</p>
      )}
    </div>
  );
}
