'use client';

import { useState } from 'react';
import type { Subject } from '@/lib/types/domain';

interface Props {
  subject: Subject;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function DeleteSubjectModal({ subject, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const canConfirm = reason.trim().length >= 10;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(22,32,51,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width: 480, maxWidth: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Remove subject</h3>
            <p style={{ fontSize: 12, color: '#71717A', margin: '2px 0 0' }}>
              Your coordinator will be notified.
            </p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#52525B" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '16px 22px' }}>
          <div style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{subject.cat}</div>
          <div style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 14px' }}>{subject.name}</div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 6 }}>
            Why are you removing this subject?
          </label>
          <p style={{ fontSize: 11, color: '#71717A', margin: '0 0 10px', lineHeight: 1.55 }}>
            Let your coordinator know — for example, if you no longer feel comfortable teaching it or want to focus on other areas.
          </p>
          <textarea
            autoFocus
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={`e.g. "I haven't taught this subject in over a year and don't feel current enough to take on new students."`}
            rows={4}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.55, boxSizing: 'border-box', color: '#18181B' }}
          />
          {reason.trim().length > 0 && reason.trim().length < 10 && (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Please add a bit more detail.</div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #F5F5F5', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 14px', borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', color: '#3F3F46', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!canConfirm}
            style={{ height: 34, padding: '0 16px', borderRadius: 7, border: 'none', background: canConfirm ? '#DC2626' : '#E4E4E7', color: canConfirm ? '#fff' : '#A1A1AA', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: canConfirm ? 'pointer' : 'default' }}
          >
            Remove subject
          </button>
        </div>
      </div>
    </div>
  );
}
