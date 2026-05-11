import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mintSchedulerEditUrl, createSchedulerConfig } from '@/lib/nylas/scheduler';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    status,
    headers: { get: () => null },
    json: async () => body,
  }));
}

beforeEach(() => {
  vi.stubEnv('NYLAS_API_KEY', 'test-key');
  vi.stubEnv('NYLAS_API_URI', 'https://api.us.nylas.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ── mintSchedulerEditUrl ──────────────────────────────────────────────────────

describe('mintSchedulerEditUrl', () => {
  it('returns the session URL when Nylas creates the session', async () => {
    mockFetch(200, {
      data: { session_id: 'sid_1', url: 'https://scheduler.nylas.com/edit?session=sid_1' },
      request_id: 'r1',
    });
    const result = await mintSchedulerEditUrl('cfg-exists');
    expect(result).toEqual({ url: 'https://scheduler.nylas.com/edit?session=sid_1' });
  });

  it('returns { url: null, error } when the config does not exist in Nylas', async () => {
    mockFetch(404, {
      error: { type: 'not_found', message: 'Configuration not found' },
      request_id: 'r2',
    });
    const result = await mintSchedulerEditUrl('cfg-stale');
    expect(result.url).toBeNull();
    expect(result.error).toBe('Configuration not found');
  });
});

// ── createSchedulerConfig ─────────────────────────────────────────────────────

describe('createSchedulerConfig', () => {
  it('returns configId and bookingUrl using the us region', async () => {
    mockFetch(200, { data: { id: 'new-cfg-id' }, request_id: 'r3' });
    const result = await createSchedulerConfig({
      tutorName: 'Jane Doe',
      tutorEmail: 'jane@example.com',
      timezone: 'America/New_York',
    });
    expect(result).toEqual({
      configId: 'new-cfg-id',
      bookingUrl: 'https://book.nylas.com/us/new-cfg-id',
    });
  });

  it('uses eu region when API URI points to EU', async () => {
    vi.stubEnv('NYLAS_API_URI', 'https://api.eu.nylas.com');
    mockFetch(200, { data: { id: 'eu-cfg-id' }, request_id: 'r4' });
    const result = await createSchedulerConfig({
      tutorName: 'Jane Doe',
      tutorEmail: 'jane@example.com',
      timezone: 'Europe/London',
    });
    expect(result?.bookingUrl).toBe('https://book.nylas.com/eu/eu-cfg-id');
  });

  it('returns null when Nylas rejects the config creation', async () => {
    mockFetch(422, {
      error: { type: 'invalid_request', message: 'Invalid participant email' },
      request_id: 'r5',
    });
    const result = await createSchedulerConfig({
      tutorName: 'Jane Doe',
      tutorEmail: 'jane@example.com',
      timezone: 'America/New_York',
    });
    expect(result).toBeNull();
  });
});
