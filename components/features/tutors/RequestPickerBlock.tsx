import { useState, useEffect, useRef } from 'react';
import type { TuitionRequest } from '@/lib/types/domain';

interface RequestPickerBlockProps {
  requests: TuitionRequest[];
  activeReq: TuitionRequest | null;
  onPick: (req: TuitionRequest) => void;
  onClear: () => void;
  onNewRequest?: () => void;
}

export function RequestPickerBlock({ requests, activeReq, onPick, onClear, onNewRequest }: RequestPickerBlockProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative border-b border-border-default px-4 py-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em]">
          {activeReq ? 'Matching for' : 'Open requests'}
        </span>
        <div className="flex items-center gap-1.5">
          {onNewRequest && (
            <button
              onClick={onNewRequest}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border-default text-[11px] font-semibold text-fg-2 hover:bg-surface-2 transition-colors"
            >
              + New
            </button>
          )}
          <button
            onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-3 border border-border-default text-[11px] font-semibold text-fg-2 hover:bg-neutral-150 transition-colors"
          >
            {requests.length} open
            <svg
              width={10} height={10} viewBox="0 0 10 10"
              className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Active request card */}
      {activeReq ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left px-3 py-2.5 rounded-lg bg-brand-ink text-fg-on-brand flex items-center gap-2.5 hover:opacity-95 transition-opacity"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold truncate">{activeReq.studentName}</div>
            <div className="text-[11px] text-neutral-400 mt-0.5 truncate">
              {activeReq.subject} · {activeReq.receivedAt}
            </div>
          </div>
          {/* Clear button */}
          <button
            aria-label="Clear request"
            onClick={e => { e.stopPropagation(); onClear(); setOpen(false); }}
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors shrink-0"
          >
            <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden>
              <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </button>
        </button>
      ) : (
        /* Empty state */
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed border-neutral-300 text-[12px] text-fg-3 flex items-center justify-between hover:border-neutral-400 transition-colors"
        >
          <span>Pick a request to start matching</span>
          <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden>
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Dropdown popover */}
      {open && (
        <div className="absolute top-[calc(100%-4px)] left-3 right-3 bg-surface-1 border border-border-default rounded-xl shadow-md z-20 max-h-96 overflow-y-auto p-1.5">
          <div className="px-2.5 py-1.5 text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em]">
            Open requests · {requests.length}
          </div>

          {requests.map(r => {
            const isActive = r.id === activeReq?.id;
            return (
              <button
                key={r.id}
                onClick={() => { onPick(r); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                  isActive ? 'bg-surface-3' : 'hover:bg-surface-2'
                }`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: r.source === 'asana' ? '#F06A6A' : 'var(--neutral-400)' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-fg-1 truncate">{r.studentName}</div>
                  <div className="text-[11px] text-fg-3 truncate">{r.subject}</div>
                </div>
                <span className="text-[10px] text-fg-muted shrink-0 whitespace-nowrap">{r.receivedAt}</span>
                {isActive && (
                  <svg width={12} height={12} viewBox="0 0 12 12" className="shrink-0" aria-hidden>
                    <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}

          {requests.length === 0 && (
            <p className="px-2.5 py-4 text-xs text-fg-muted text-center">No open requests.</p>
          )}

          {activeReq && (
            <>
              <div className="h-px bg-border-default my-1" />
              <button
                onClick={() => { onClear(); setOpen(false); }}
                className="flex w-full items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-fg-3 hover:bg-surface-2 transition-colors"
              >
                <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden>
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
                Clear — just browse tutors
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
