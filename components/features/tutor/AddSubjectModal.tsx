'use client';

import { useState } from 'react';
import type { Subject, TutorSubject } from '@/lib/types/domain';

interface Props {
  allSubjects: Subject[];
  existing: string[];
  onClose: () => void;
  onAdd: (ts: TutorSubject) => void;
}

export function AddSubjectModal({ allSubjects, existing, onClose, onAdd }: Props) {
  const [query, setQuery]     = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [note, setNote]       = useState('');

  const available = allSubjects.filter(s =>
    !existing.includes(s.id) &&
    (!query || s.name.toLowerCase().includes(query.toLowerCase())),
  );
  const picked = allSubjects.find(s => s.id === pickedId);
  const canAdd = !!picked && note.trim().length >= 10;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(22,32,51,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width: 520, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add a subject</h3>
            <p style={{ fontSize: 12, color: '#71717A', margin: '2px 0 0' }}>
              {!pickedId ? 'Choose a subject from the list.' : 'Tell your coordinator about your experience.'}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#52525B" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        {!pickedId ? (
          /* Step 1: Search & pick */
          <>
            <div style={{ padding: '14px 22px 10px' }}>
              <div style={{ position: 'relative' }}>
                <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round" style={{ position: 'absolute', left: 10, top: 11 }} aria-hidden>
                  <circle cx={6} cy={6} r={4.5} /><path d="M10 10l2 2" />
                </svg>
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search subjects…"
                  style={{ width: '100%', height: 36, padding: '0 12px 0 32px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 14px' }}>
              {available.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#A1A1AA', fontSize: 12 }}>No matching subjects</div>
              )}
              {available.map(s => (
                <button
                  key={s.id}
                  onClick={() => setPickedId(s.id)}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FAFAFA'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5F5F5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="#71717A" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
                      <rect x={1.5} y={1.5} width={11} height={11} rx={2} /><path d="M4 5h6M4 7.5h4" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 1 }}>{s.cat}</div>
                  </div>
                  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round" style={{ transform: 'rotate(-90deg)' }} aria-hidden>
                    <path d="M2 4l4 4 4-4" />
                  </svg>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Step 2: Qualification note */
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
              <button
                onClick={() => setPickedId(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: '#71717A', fontFamily: 'inherit', padding: 0, marginBottom: 14 }}
              >
                <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="#71717A" strokeWidth={1.5} strokeLinecap="round" style={{ transform: 'rotate(90deg)' }} aria-hidden><path d="M2 3l3 3 3-3" /></svg>
                Back to subjects
              </button>

              <div style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{picked!.cat}</div>
              <div style={{ fontSize: 20, fontWeight: 700, margin: '2px 0 16px' }}>{picked!.name}</div>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 6 }}>
                Describe your experience teaching {picked!.name}
              </label>
              <p style={{ fontSize: 11, color: '#71717A', margin: '0 0 10px', lineHeight: 1.55 }}>
                Your coordinator will review this and set a confidence level. Be specific — scores, years of experience, or student outcomes all help.
              </p>
              <textarea
                autoFocus
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={`e.g. "Scored a 5 on the AP exam and tutored 3 students through it last year, all scoring 4 or 5."`}
                rows={5}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.55, boxSizing: 'border-box', color: '#18181B' }}
              />
              {note.trim().length > 0 && note.trim().length < 10 && (
                <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Please add a bit more detail.</div>
              )}

              <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: '#F4F4F5', border: '1px solid #E4E4E7', fontSize: 12, color: '#52525B', lineHeight: 1.5 }}>
                This subject will be added with <b>Unproven</b> confidence. Your coordinator will update this as you work with students in this subject.
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid #F5F5F5', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} style={{ height: 34, padding: '0 14px', borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', color: '#3F3F46', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => onAdd({ id: picked!.id, conf: 'MEDIUM', qualificationNote: note.trim() })}
                disabled={!canAdd}
                style={{ height: 34, padding: '0 16px', borderRadius: 7, border: 'none', background: canAdd ? '#18181B' : '#E4E4E7', color: canAdd ? '#fff' : '#A1A1AA', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: canAdd ? 'pointer' : 'default' }}
              >
                Add {picked!.name}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
