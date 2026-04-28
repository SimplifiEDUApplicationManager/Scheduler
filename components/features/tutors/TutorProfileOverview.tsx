import type { Tutor, Subject } from '@/lib/data/dashboard-mock';
import { Badge } from '@/components/ui/Badge';
import { DrawerCard } from './DrawerCard';

interface Props {
  tutor: Tutor;
  subjects: Subject[];
}

export function TutorProfileOverview({ tutor, subjects }: Props) {
  return (
    <div className="p-5 flex flex-col gap-3.5">
      <DrawerCard title="About">
        <p className="text-[13px] text-fg-2 leading-relaxed m-0">{tutor.bio}</p>
      </DrawerCard>

      <DrawerCard title="Teaching style">
        <p className="text-[13px] text-fg-2 leading-relaxed italic m-0">"{tutor.personality}"</p>
        <div className="mt-2.5 px-2.5 py-2 bg-neutral-50 rounded-md text-[11px] text-fg-3 flex items-center gap-1.5">
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <circle cx={6} cy={6} r={5} /><path d="M6 5.5v3M6 3.5h.01" strokeLinecap="round" />
          </svg>
          Coordinators edit personality notes
        </div>
      </DrawerCard>

      <DrawerCard title={`Subjects · ${tutor.subjects.length}`}>
        <div className="flex flex-col gap-1.5">
          {tutor.subjects.map(s => {
            const subj = subjects.find(x => x.id === s.id);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2 bg-neutral-50 rounded-lg"
              >
                <span className="text-[12px] font-semibold text-fg-1">{subj?.name ?? s.id}</span>
                <Badge variant={s.conf} size="xs">{s.conf}</Badge>
              </div>
            );
          })}
        </div>
      </DrawerCard>
    </div>
  );
}
