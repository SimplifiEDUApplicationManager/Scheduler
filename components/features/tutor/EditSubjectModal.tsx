'use client';

import { useState } from 'react';
import type { Subject, SubjectConf, TutorSubject } from '@/lib/types/domain';

interface Props {
  ts: TutorSubject;
  subject: Subject;
  onClose: () => void;
  onSave: (updated: Pick<TutorSubject, 'conf' | 'qualificationNote'>) => void;
}

const CONF_OPTIONS: { value: SubjectConf; label: string; desc: string }[] = [
  { value: 'HIGH',   label: 'High',   desc: 'Can teach confidently' },
  { value: 'MEDIUM', label: 'Medium', desc: 'Can teach with a little preparation' },
  { value: 'LOW',    label: 'Low',    desc: 'Can teach with a lot of preparation' },
];

export function EditSubjectModal({ ts, subject, onClose, onSave }: Props) {
  const [conf, setConf] = useState<SubjectConf>(ts.conf);
  const [note, setNote] = useState('');

  const canSave = note.trim().length >= 10;

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
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Edit subject</h3>
            <p style={{ fontSize: 12, color: '#71717A', margin: '2px 0 0' }}>Update your confidence level and explain what changed.</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#52525B" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          <div style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{subject.cat}</div>
          <div style={{ fontSize: 20, fontWeight: 700, margin: '2px 0 16px' }}>{subject.name}</div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 8 }}>
            My confidence level
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {CONF_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setConf(opt.value)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 8,
                  border: conf === opt.value ? '2px solid #18181B' : '1px solid #E4E4E7',
                  background: conf === opt.value ? '#18181B' : '#fff',
                  color: conf === opt.value ? '#fff' : '#3F3F46',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>{opt.label}</div>
                <div style={{ fontSize: 10, marginTop: 2, opacity: 0.75 }}>{opt.desc}</div>
              </button>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 6 }}>
            What changed?
          </label>
          <p style={{ fontSize: 11, color: '#71717A', margin: '0 0 10px', lineHeight: 1.55 }}>
            Briefly explain why you&apos;re updating your confidence — your coordinator will be notified.
          </p>
          <textarea
            autoFocus
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={`e.g. "I've now tutored 5 students through AP Calc BC and all scored 4 or 5."`}
            rows={4}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.55, boxSizing: 'border-box', color: '#18181B' }}
          />
          {note.trim().length > 0 && note.trim().length < 10 && (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Please add a bit more detail.</div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #F5F5F5', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 14px', borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', color: '#3F3F46', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => onSave({ conf, qualificationNote: note.trim() })}
            disabled={!canSave}
            style={{ height: 34, padding: '0 16px', borderRadius: 7, border: 'none', background: canSave ? '#18181B' : '#E4E4E7', color: canSave ? '#fff' : '#A1A1AA', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: canSave ? 'pointer' : 'default' }}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
