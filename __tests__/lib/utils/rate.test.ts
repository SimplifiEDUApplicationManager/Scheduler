import { describe, it, expect } from 'vitest';
import { isValidRate } from '@/lib/utils/rate';

describe('isValidRate', () => {
  it('accepts all valid increments: 20, 25, 30, 35, 40', () => {
    expect(isValidRate(20)).toBe(true);
    expect(isValidRate(25)).toBe(true);
    expect(isValidRate(30)).toBe(true);
    expect(isValidRate(35)).toBe(true);
    expect(isValidRate(40)).toBe(true);
  });

  it('rejects values below 20', () => {
    expect(isValidRate(15)).toBe(false);
    expect(isValidRate(0)).toBe(false);
    expect(isValidRate(-5)).toBe(false);
  });

  it('rejects values above 40', () => {
    expect(isValidRate(45)).toBe(false);
    expect(isValidRate(100)).toBe(false);
  });

  it('rejects non-$5-increment values within range', () => {
    expect(isValidRate(21)).toBe(false);
    expect(isValidRate(22)).toBe(false);
    expect(isValidRate(37)).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(isValidRate(22.5)).toBe(false);
    expect(isValidRate(30.1)).toBe(false);
  });

  it('rejects non-number types', () => {
    expect(isValidRate('20')).toBe(false);
    expect(isValidRate(null)).toBe(false);
    expect(isValidRate(undefined)).toBe(false);
  });
});
