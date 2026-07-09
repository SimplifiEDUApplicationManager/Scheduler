'use client';

import { useState } from 'react';
import type { Tutor, Subject } from '@/lib/types/domain';
import { subjectDisplayName } from '@/lib/types/domain';
import { Badge } from '@/components/ui/Badge';
import { DrawerCard } from './DrawerCard';

interface Props {
  tutor: Tutor;
  subjects: Subject[];
  contextPersonality?: string;
  onSavePersonality?: (text: string) => Promise<void>;
}

export function TutorProfileOverview({ tutor, subjects, contextPersonality, onSavePersonality }: Props) {
  const personality = contextPersonality ?? tutor.personality;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSavePersonality) return;
    setSaving(true);
    await onSavePersonality(draft);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="p-5 flex flex-col gap-3.5">
      <DrawerCard title="About">
        {tutor.bio
          ? <p className="text-[13px] text-fg-2 leading-relaxed m-0">{tutor.bio}</p>
          : <p className="text-[13px] text-fg-muted m-0">No bio yet.</p>
        }
      </DrawerCard>

      <DrawerCard title="Teaching style">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
              rows={4}
              className="w-full text-[13px] text-fg-2 leading-relaxed border border-border-default rounded-md p-2 resize-y font-sans bg-white outline-none focus:border-brand-teal"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="h-7 px-2.5 rounded-md border border-border-default text-fg-3 text-[11px] font-semibold hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-7 px-2.5 rounded-md bg-brand-ink text-white text-[11px] font-semibold hover:bg-neutral-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {personality
              ? <p className="text-[13px] text-fg-2 leading-relaxed italic m-0">&ldquo;{personality}&rdquo;</p>
              : <p className="text-[13px] text-fg-muted m-0">No notes yet.</p>
            }
            {onSavePersonality ? (
              <button
                onClick={() => { setDraft(personality ?? ''); setEditing(true); }}
                className="mt-2 text-[11px] text-brand-teal font-semibold hover:underline"
              >
                Edit notes
              </button>
            ) : (
              <div className="mt-2.5 px-2.5 py-2 bg-neutral-50 rounded-md text-[11px] text-fg-3 flex items-center gap-1.5">
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <circle cx={6} cy={6} r={5} /><path d="M6 5.5v3M6 3.5h.01" strokeLinecap="round" />
                </svg>
                Coordinators edit personality notes
              </div>
            )}
          </>
        )}
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
                <span className="text-[12px] font-semibold text-fg-1">{subj ? subjectDisplayName(subj) : s.id}</span>
                <Badge variant={s.conf} size="xs">{s.conf}</Badge>
              </div>
            );
          })}
        </div>
      </DrawerCard>
    </div>
  );
}
