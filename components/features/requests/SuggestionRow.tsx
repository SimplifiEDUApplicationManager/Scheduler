import type { Tutor, SubjectConf } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

interface Props {
  tutor: Tutor;
  conf: SubjectConf;
  matches: number;
  totalTuples: number;
  available: boolean;
  onPropose: () => void;
}

export function SuggestionRow({ tutor, conf, matches, totalTuples, available, onPropose }: Props) {
  const allMatch = matches === totalTuples;
  return (
    <div
      className="flex items-center gap-2.5 px-2.5 py-2.5 border border-neutral-100 rounded-lg"
      style={{ opacity: available ? 1 : 0.55 }}
    >
      <Avatar initials={tutor.initials} size="sm" tone="brand" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-fg-1 truncate">{tutor.name}</span>
          <Badge variant={conf} size="xs">{conf}</Badge>
        </div>
        <div className="text-[10px] text-fg-3 mt-0.5">
          {allMatch ? 'All windows match' : `${matches}/${totalTuples} window${totalTuples === 1 ? '' : 's'} match`}
          {!available && ' · At capacity'}
        </div>
      </div>
      <button
        onClick={onPropose}
        disabled={!available}
        className="h-6 px-2.5 rounded-md text-[11px] font-semibold bg-brand-ink text-white disabled:bg-neutral-100 disabled:text-fg-muted disabled:cursor-not-allowed hover:bg-neutral-700 transition-colors shrink-0"
      >
        Propose
      </button>
    </div>
  );
}
