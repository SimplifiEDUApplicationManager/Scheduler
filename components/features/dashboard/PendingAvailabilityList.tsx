import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

const REQUEST_LABELS: Record<string, string> = {
  PAUSE:                    'Pause availability',
  LOW_MAX_HOURS:            'Reduce max hours',
  LOW_AVAILABILITY_WINDOWS: 'Low availability windows',
};

export interface PendingAvailabilityItem {
  tutorName: string;
  tutorInitials: string;
  requestType: string;
  reason: string;
}

export function PendingAvailabilityList({ items }: { items: PendingAvailabilityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-5 text-center">
        <p className="text-xs font-semibold text-fg-muted mt-1.5">No pending requests</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.slice(0, 4).map((item, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 bg-surface-2 rounded-lg">
          <Avatar initials={item.tutorInitials} size="sm" tone="brand" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-fg-1">{item.tutorName.split(' ')[0]}</div>
            <div className="text-[10px] text-fg-3 mt-px truncate">{item.reason}</div>
          </div>
          <Badge variant="warning" size="xs">{REQUEST_LABELS[item.requestType] ?? item.requestType}</Badge>
        </div>
      ))}
      {items.length > 4 && (
        <p className="text-[11px] text-fg-muted pt-1">+{items.length - 4} more</p>
      )}
    </div>
  );
}
