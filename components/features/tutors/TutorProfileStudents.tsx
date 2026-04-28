import type { FakeStudent } from '@/lib/utils/fake-roster';
import { Avatar } from '@/components/ui/Avatar';

function initialsFrom(name: string) {
  const parts = name.split(' ');
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

interface Props {
  roster: FakeStudent[];
}

export function TutorProfileStudents({ roster }: Props) {
  if (roster.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-8">
        <div className="text-[13px] font-semibold text-fg-2 mt-3">No active students</div>
        <div className="text-[11px] text-fg-3 mt-1">
          Students appear here once sessions are confirmed.
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-2.5">
      {roster.map((s, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3.5 py-3 bg-white border border-neutral-200 rounded-xl"
        >
          <Avatar initials={initialsFrom(s.name)} size="md" tone="cream" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-fg-1">{s.name}</span>
              {s.atRisk && (
                <span className="text-[9px] font-bold px-1.5 py-px rounded bg-danger-bg text-danger-ink uppercase tracking-wide">
                  At risk
                </span>
              )}
            </div>
            <div className="text-[11px] text-fg-3 mt-0.5">
              {s.subject} · {s.hoursPerWeek}h/wk · Started {s.since}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-bold text-fg-1">{s.sessions}</div>
            <div className="text-[10px] text-fg-muted">sessions</div>
          </div>
        </div>
      ))}
    </div>
  );
}
