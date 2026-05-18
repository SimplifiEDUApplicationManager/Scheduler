export interface TupleColor {
  strong: string;
  soft: string;
  band: string;
  bandBright: string;
  borderDash: string;
  shadow: string;
}

export const TUPLE_COLORS: TupleColor[] = [
  { strong: '#0891B2', soft: '#ECFEFF', band: 'rgba(8,145,178,0.12)',  bandBright: 'rgba(8,145,178,0.28)',  borderDash: 'rgba(8,145,178,0.55)',  shadow: 'rgba(8,145,178,0.20)'  },
  { strong: '#7C3AED', soft: '#F5F3FF', band: 'rgba(124,58,237,0.12)', bandBright: 'rgba(124,58,237,0.28)', borderDash: 'rgba(124,58,237,0.55)', shadow: 'rgba(124,58,237,0.20)' },
  { strong: '#D97706', soft: '#FFFBEB', band: 'rgba(217,119,6,0.12)',  bandBright: 'rgba(217,119,6,0.30)',  borderDash: 'rgba(217,119,6,0.55)',  shadow: 'rgba(217,119,6,0.20)'  },
  { strong: '#DB2777', soft: '#FDF2F8', band: 'rgba(219,39,119,0.12)', bandBright: 'rgba(219,39,119,0.28)', borderDash: 'rgba(219,39,119,0.55)', shadow: 'rgba(219,39,119,0.20)' },
  { strong: '#059669', soft: '#ECFDF5', band: 'rgba(5,150,105,0.12)',  bandBright: 'rgba(5,150,105,0.28)',  borderDash: 'rgba(5,150,105,0.55)',  shadow: 'rgba(5,150,105,0.20)'  },
];

export function countFitSlots(windows: { start: number; end: number }[], dur: number): number {
  return windows.reduce((n, w) => {
    const span = (w.end - w.start) - dur;
    if (span < 0) return n;
    return n + Math.floor(span / 0.25) + 1; // 15-min slots
  }, 0);
}
