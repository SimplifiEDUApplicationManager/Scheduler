import type { Tutor, Subject, Tuple } from '@/lib/types/domain';
import { overlapHours } from '@/lib/utils/tutors';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { capacityStatus } from '@/lib/utils/capacity';
import { cn } from '@/lib/utils/cn';

interface TutorCardProps {
  tutor: Tutor;
  subjects: Subject[];
  activeTuples: Tuple[];
  activeSubjectId: string | undefined;
  selected: boolean;
  canPropose: boolean;
  onSelect: () => void;
  onPropose: () => void;
  onProfile: () => void;
}

export function TutorCard({
  tutor,
  subjects,
  activeTuples,
  activeSubjectId,
  selected,
  canPropose,
  onSelect,
  onPropose,
  onProfile,
}: TutorCardProps) {
  const atCap   = tutor.hoursCurrent >= tutor.hoursMax;
  const capSt   = capacityStatus(tutor.hoursCurrent, tutor.hoursMax);
  const matchH  = activeTuples.length > 0 ? overlapHours(tutor.availability, activeTuples) : 0;

  // The subject that matches the active filter (if any)
  const subjectMatch = activeSubjectId
    ? tutor.subjects.find(ts => ts.id === activeSubjectId)
    : null;

  const pct = Math.min(100, Math.round((tutor.hoursCurrent / tutor.hoursMax) * 100));
  const barColor =
    capSt === 'at' ? 'bg-danger' : capSt === 'near' ? 'bg-warning' : 'bg-brand-teal-500';

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative px-4 py-3 border-b border-neutral-100 cursor-pointer transition-colors',
        selected ? 'bg-brand-ink text-fg-on-brand' : 'hover:bg-surface-2',
      )}
    >
      {subjectMatch?.coordConf && (
        <div className="absolute top-2 right-2">
          <Badge variant={subjectMatch.coordConf} size="xs">C: {subjectMatch.coordConf}</Badge>
        </div>
      )}
      <div className="flex gap-2.5 items-start">
        <Avatar
          initials={tutor.initials}
          src={tutor.photoUrl}
          size="md"
          tone={selected ? 'dark' : 'brand'}
        />

        <div className="flex-1 min-w-0">
          {/* Name + capacity badge */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn('text-[13px] font-semibold truncate flex-1', selected ? 'text-fg-on-brand' : 'text-fg-1')}>
              {tutor.name}
            </span>
            {atCap && (
              <span className={cn(
                'text-[9px] font-bold px-1.5 py-px rounded whitespace-nowrap',
                selected ? 'bg-danger-ink text-danger-bg' : 'bg-danger-bg text-danger-ink',
              )}>
                At capacity
              </span>
            )}
            {!atCap && capSt === 'near' && (
              <span className={cn(
                'text-[9px] font-bold px-1.5 py-px rounded whitespace-nowrap',
                selected ? 'bg-warning-ink text-warning-bg' : 'bg-warning-bg text-warning-ink',
              )}>
                Near cap
              </span>
            )}
          </div>

          {/* Subject chips */}
          <div className="flex flex-wrap gap-1 mt-1">
            {subjectMatch ? (
              <>
                <span className={cn(
                  'text-[10px] px-1.5 py-px rounded font-medium',
                  selected ? 'bg-neutral-700 text-neutral-300' : 'bg-surface-3 text-fg-2',
                )}>
                  {subjects.find(s => s.id === subjectMatch.id)?.name}
                </span>
                <Badge variant={subjectMatch.conf} size="xs">{subjectMatch.conf}</Badge>
              </>
            ) : (
              <>
                {tutor.subjects.slice(0, 3).map(ts => (
                  <span
                    key={ts.id}
                    className={cn(
                      'text-[10px] px-1.5 py-px rounded font-medium',
                      selected ? 'bg-neutral-700 text-neutral-300' : 'bg-surface-3 text-fg-2',
                    )}
                  >
                    {subjects.find(s => s.id === ts.id)?.name}
                  </span>
                ))}
                {tutor.subjects.length > 3 && (
                  <span className={cn('text-[10px]', selected ? 'text-neutral-400' : 'text-fg-muted')}>
                    +{tutor.subjects.length - 3}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Capacity bar + match hours */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 max-w-[120px]">
              <div className={cn('text-[9px] mb-1', selected ? 'text-neutral-400' : 'text-fg-muted')}>
                {tutor.hoursCurrent}/{tutor.hoursMax}h this week
              </div>
              <div className={cn('h-[3px] rounded-full overflow-hidden', selected ? 'bg-neutral-700' : 'bg-surface-3')}>
                <div
                  className={cn('h-full rounded-full', barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            {matchH > 0 && (
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-px rounded whitespace-nowrap',
                selected ? 'text-brand-teal-200' : 'bg-brand-teal-50 text-brand-primary-ink',
              )}>
                {matchH}h match
              </span>
            )}
          </div>

          {/* Expanded actions when selected */}
          {selected && (
            <div className="mt-2.5 flex gap-1.5">
              {canPropose && (
                <button
                  onClick={e => { e.stopPropagation(); onPropose(); }}
                  className="flex-1 h-7 rounded-md bg-surface-1 text-brand-ink text-[11px] font-semibold hover:bg-surface-2 transition-colors"
                >
                  Propose
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); onProfile(); }}
                className={cn(
                  'h-7 rounded-md border border-neutral-600 text-fg-on-brand text-[11px] font-semibold hover:bg-neutral-700 transition-colors',
                  canPropose ? 'flex-1' : 'flex-1',
                )}
              >
                Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
