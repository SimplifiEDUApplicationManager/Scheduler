import type { Tuple } from '@/lib/types/domain';
import { DAY_NAMES, fmtHour } from '@/lib/utils/tutors';

interface TupleRowProps {
  tuple: Tuple;
  onChange: (t: Tuple) => void;
  onRemove: () => void;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0–24 (12 AM – 12 AM)

const selectCls =
  'h-[26px] px-1.5 text-[11px] border border-border-default rounded bg-surface-1 ' +
  'font-medium text-fg-1 focus:outline-none focus:border-neutral-400';

export function TupleRow({ tuple, onChange, onRemove }: TupleRowProps) {
  return (
    <div className="grid grid-cols-[56px_1fr_1fr_16px] gap-1 items-center">
      <select
        value={tuple.day}
        onChange={e => onChange({ ...tuple, day: +e.target.value })}
        className={selectCls}
      >
        {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
      </select>

      <select
        value={tuple.start}
        onChange={e => onChange({ ...tuple, start: +e.target.value })}
        className={selectCls}
      >
        {HOURS.map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
      </select>

      <select
        value={tuple.end}
        onChange={e => onChange({ ...tuple, end: +e.target.value })}
        className={selectCls}
      >
        {HOURS.slice(1).map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
      </select>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove window"
        className="flex items-center justify-center text-fg-muted hover:text-fg-2 transition-colors"
      >
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
          <path d="M2 2L10 10M10 2L2 10" />
        </svg>
      </button>
    </div>
  );
}
