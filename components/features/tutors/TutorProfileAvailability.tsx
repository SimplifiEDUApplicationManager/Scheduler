import type { Tutor } from '@/lib/data/dashboard-mock';
import { DAY_NAMES } from '@/lib/utils/tutors';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { DrawerCard } from './DrawerCard';

interface Props {
  tutor: Tutor;
  tzLabel: string;
}

function MiniAvailability({ tutor }: { tutor: Tutor }) {
  const START = 8, END = 22;
  const rows = (END - START) / 2;

  return (
    <div className="grid gap-0.5 text-[9px]" style={{ gridTemplateColumns: '28px repeat(7, 1fr)' }}>
      {/* Day headers */}
      <div />
      {DAY_NAMES.map(d => (
        <div key={d} className="text-center text-[10px] font-semibold text-fg-3 py-0.5">{d}</div>
      ))}

      {/* Hour rows */}
      {Array.from({ length: rows }, (_, i) => {
        const hr = START + i * 2;
        const label = hr < 12 ? `${hr}a` : hr === 12 ? '12p' : `${hr - 12}p`;
        return (
          <div key={hr} className="contents">
            <div className="text-right pr-1 text-fg-muted tabular-nums leading-4" style={{ paddingTop: 2 }}>
              {label}
            </div>
            {[0, 1, 2, 3, 4, 5, 6].map(day => {
              const windows = tutor.availability[day] ?? [];
              const full = windows.some(([s, e]) => s <= hr && e >= hr + 2);
              const partial = !full && windows.some(([s, e]) => s < hr + 2 && e > hr);
              return (
                <div
                  key={day}
                  className="h-4 rounded-sm"
                  style={{
                    background: full ? '#E8F4F1' : partial ? '#F2FAF8' : '#FAFAFA',
                    border: `1px solid ${full ? '#B3DFD4' : '#F0F0F0'}`,
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}


export function TutorProfileAvailability({ tutor, tzLabel }: Props) {
  return (
    <div className="p-5 flex flex-col gap-3.5">
      <DrawerCard title="Weekly availability">
        <p className="text-[11px] text-fg-3 mb-3 leading-snug">
          Committed windows from {tutor.name.split(' ')[0]}'s scheduling preferences in {tzLabel} time.
        </p>
        <MiniAvailability tutor={tutor} />
      </DrawerCard>

      <DrawerCard title="Hours committed">
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[32px] font-extrabold text-fg-1 leading-none tracking-tight">
              {tutor.hoursCurrent}
            </div>
            <div className="text-[11px] text-fg-3 mt-1">of {tutor.hoursMax}h this week</div>
          </div>
          <div className="flex-1 pb-1.5">
            <CapacityBar current={tutor.hoursCurrent} max={tutor.hoursMax} showLabel={false} />
            <div className="text-[10px] text-fg-muted mt-1">
              Min {tutor.hoursMin}h · Max {tutor.hoursMax}h per week
            </div>
          </div>
        </div>
      </DrawerCard>
    </div>
  );
}
