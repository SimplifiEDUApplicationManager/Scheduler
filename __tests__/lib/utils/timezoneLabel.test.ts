import { describe, it, expect } from 'vitest';
import { formatTimezoneLabel, convertTupleTimezone } from '@/lib/utils/timezone';

// Fixed instants used throughout — pinned so tests never drift with real time.
// Jan 15 2025 12:00 UTC  → deep winter, DST inactive in US/Europe
// Jul 15 2025 12:00 UTC  → deep summer, DST active in US/Europe
const WINTER = new Date('2025-01-15T12:00:00Z').getTime();
const SUMMER = new Date('2025-07-15T12:00:00Z').getTime();

describe('formatTimezoneLabel — offset', () => {
  it('America/New_York in winter shows UTC-5 offset', () => {
    const label = formatTimezoneLabel('America/New_York', WINTER);
    expect(label).toMatch(/UTC-5/);
  });

  it('America/New_York in summer shows UTC-4 offset (DST)', () => {
    const label = formatTimezoneLabel('America/New_York', SUMMER);
    expect(label).toMatch(/UTC-4/);
  });

  it('Asia/Kolkata shows UTC+5:30 (half-hour offset)', () => {
    const label = formatTimezoneLabel('Asia/Kolkata', WINTER);
    expect(label).toMatch(/UTC\+5:30/);
  });

  it('replaces underscores with spaces in city portion', () => {
    const label = formatTimezoneLabel('America/New_York', WINTER);
    expect(label).toContain('America/New York');
    expect(label).not.toContain('_');
  });

  it('label format is "UTC±offset — City/Region"', () => {
    const label = formatTimezoneLabel('America/New_York', WINTER);
    expect(label).toMatch(/^UTC[-+][\d:]+ — .+$/);
  });
});

describe('formatTimezoneLabel — IANA values work with convertTupleTimezone', () => {
  it('tz value from label round-trips correctly through convertTupleTimezone', () => {
    // Mon 5–7 PM ET → Mon 2–4 PM PT (standard offset test)
    const result = convertTupleTimezone(
      { day: 1, start: 17, end: 19 },
      'America/New_York',
      'America/Los_Angeles',
    );
    expect(result).toEqual({ day: 1, start: 14, end: 16 });
  });

  it('Intl.supportedValuesOf zones are valid IANA strings accepted by convertTupleTimezone', () => {
    // Spot-check: a few zones that appear in the dropdown should not throw
    const zones = ['America/Chicago', 'Europe/London', 'Asia/Tokyo', 'Pacific/Auckland'];
    for (const tz of zones) {
      expect(() =>
        convertTupleTimezone({ day: 1, start: 9, end: 10 }, 'America/New_York', tz)
      ).not.toThrow();
    }
  });
});
