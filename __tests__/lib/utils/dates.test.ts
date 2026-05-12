import { describe, it, expect } from 'vitest';
import { toIsoDate } from '@/lib/utils/dates';

describe('toIsoDate', () => {
  it('returns null for year-less strings like "May 6"', () => {
    expect(toIsoDate('May 6')).toBeNull();
  });

  it('returns null for "ASAP"', () => {
    expect(toIsoDate('ASAP')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(toIsoDate('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toIsoDate(undefined)).toBeNull();
  });

  it('passes through an already-ISO date unchanged', () => {
    expect(toIsoDate('2026-05-06')).toBe('2026-05-06');
  });

  it('parses a full English date string that contains a year', () => {
    expect(toIsoDate('May 6, 2026')).toBe('2026-05-06');
  });
});
