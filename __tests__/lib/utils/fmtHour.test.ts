import { describe, it, expect } from 'vitest';
import { fmtHour, fmtRange } from '@/lib/utils/tutors';

// ── fmtHour ───────────────────────────────────────────────────────────────

describe('fmtHour — on the hour', () => {
  it('formats a PM hour correctly', () => {
    expect(fmtHour(16)).toBe('4 PM');
  });

  it('formats an AM hour correctly', () => {
    expect(fmtHour(9)).toBe('9 AM');
  });

  it('formats midnight as 12 AM', () => {
    expect(fmtHour(0)).toBe('12 AM');
  });

  it('formats noon as 12 PM', () => {
    expect(fmtHour(12)).toBe('12 PM');
  });

  it('formats 11 PM correctly', () => {
    expect(fmtHour(23)).toBe('11 PM');
  });
});

describe('fmtHour — with minutes', () => {
  it('formats a half-hour', () => {
    expect(fmtHour(9.5)).toBe('9:30 AM');
  });

  it('formats a quarter-hour', () => {
    expect(fmtHour(14.25)).toBe('2:15 PM');
  });

  it('zero-pads single-digit minutes', () => {
    expect(fmtHour(9 + 5 / 60)).toBe('9:05 AM');
  });
});

// ── fmtRange ─────────────────────────────────────────────────────────────

describe('fmtRange — same period', () => {
  it('omits the period from the start when both times are PM', () => {
    expect(fmtRange(16, 19)).toBe('4–7 PM');
  });

  it('omits the period from the start when both times are AM', () => {
    expect(fmtRange(9, 11)).toBe('9–11 AM');
  });

  it('handles a same-period range with minutes', () => {
    expect(fmtRange(9.5, 11.5)).toBe('9:30–11:30 AM');
  });
});

describe('fmtRange — cross-period', () => {
  it('includes both periods when start is AM and end is PM', () => {
    expect(fmtRange(11, 13)).toBe('11 AM–1 PM');
  });

  it('handles a cross-period range with minutes', () => {
    expect(fmtRange(11.5, 12.5)).toBe('11:30 AM–12:30 PM');
  });
});
