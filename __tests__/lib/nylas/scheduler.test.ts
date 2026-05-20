import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mintSchedulerEditUrl, createSchedulerConfig, enableSchedulerSessionAuth } from '@/lib/nylas/scheduler';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    status,
    headers: { get: () => null },
    json: async () => body,
  }));
}

function mockFetchSequence(...calls: Array<{ status: number; body: unknown }>) {
  let mock = vi.fn();
  for (const call of calls) {
    mock = mock.mockResolvedValueOnce({
      status: call.status,
      headers: { get: () => null },
      json: async () => call.body,
    });
  }
  vi.stubGlobal('fetch', mock);
}

beforeEach(() => {
  vi.stubEnv('NYLAS_API_KEY', 'test-key');
  vi.stubEnv('NYLAS_API_URI', 'https://api.us.nylas.com');
  vi.stubEnv('NYLAS_CLIENT_ID', 'test-client-id');
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

  it('returns { url: null, configGone: true } on a 404 from Nylas', async () => {
    mockFetch(404, {
      error: { type: 'not_found', message: 'Configuration not found' },
      request_id: 'r2',
    });
    const result = await mintSchedulerEditUrl('cfg-stale');
    expect(result.url).toBeNull();
    expect((result as { error: string; configGone: boolean }).error).toBe('Configuration not found');
    expect((result as { configGone: boolean }).configGone).toBe(true);
  });

  it('returns { url: null, configGone: false } on a transient 500 from Nylas', async () => {
    mockFetch(500, {
      error: { type: 'server_error', message: 'Internal server error' },
      request_id: 'r2b',
    });
    const result = await mintSchedulerEditUrl('cfg-ok');
    expect(result.url).toBeNull();
    expect((result as { configGone: boolean }).configGone).toBe(false);
  });
});

// ── enableSchedulerSessionAuth ────────────────────────────────────────────────

describe('enableSchedulerSessionAuth', () => {
  it('GETs and PUTs to grant-scoped endpoints and returns true on success', async () => {
    mockFetchSequence(
      { status: 200, body: { data: { id: 'cfg-1', name: 'Test', requires_session_auth: false }, request_id: 'r1' } },
      { status: 200, body: { data: { id: 'cfg-1' }, request_id: 'r2' } },
    );
    const fetchSpy = vi.mocked(fetch);
    const result = await enableSchedulerSessionAuth('cfg-1', 'grant-abc');
    expect(result).toBe(true);
    // Verify grant-scoped URLs were used
    expect((fetchSpy.mock.calls[0]![0] as string)).toContain('/v3/grants/grant-abc/scheduling/configurations/cfg-1');
    expect((fetchSpy.mock.calls[1]![0] as string)).toContain('/v3/grants/grant-abc/scheduling/configurations/cfg-1');
  });

  it('returns false when the GET fails', async () => {
    mockFetch(404, { error: { type: 'not_found', message: 'Not found' }, request_id: 'r3' });
    const result = await enableSchedulerSessionAuth('cfg-missing', 'grant-abc');
    expect(result).toBe(false);
  });
});

// ── createSchedulerConfig ─────────────────────────────────────────────────────

describe('createSchedulerConfig', () => {
  it('returns configId and bookingUrl with region/clientId/slug format', async () => {
    mockFetch(200, { data: { id: 'new-cfg-id' }, request_id: 'r3' });
    const result = await createSchedulerConfig({
      tutorName: 'Jane Doe',
      tutorEmail: 'jane@example.com',
      timezone: 'America/New_York',
      grantId: 'grant-123',
    });
    expect(result).toEqual({
      configId: 'new-cfg-id',
      bookingUrl: 'https://book.nylas.com/us/test-client-id/jane',
    });
  });

  it('POSTs to grant-scoped endpoint, includes slug, and excludes grant_id from participants', async () => {
    mockFetch(200, { data: { id: 'new-cfg-id' }, request_id: 'r3b' });
    const fetchSpy = vi.mocked(fetch);
    await createSchedulerConfig({
      tutorName: 'Jane Doe',
      tutorEmail: 'jane.doe@example.com',
      timezone: 'America/New_York',
      grantId: 'grant-123',
    });
    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain('/v3/grants/grant-123/scheduling/configurations');
    const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
    expect(body.participants[0]).not.toHaveProperty('grant_id');
    // Slug derived from email local-part; dots become hyphens
    expect(body.slug).toBe('jane-doe');
  });

  it('uses eu region when API URI points to EU', async () => {
    vi.stubEnv('NYLAS_API_URI', 'https://api.eu.nylas.com');
    mockFetch(200, { data: { id: 'eu-cfg-id' }, request_id: 'r4' });
    const result = await createSchedulerConfig({
      tutorName: 'Jane Doe',
      tutorEmail: 'jane@example.com',
      timezone: 'Europe/London',
      grantId: 'grant-123',
    });
    expect(result?.configId ? result.bookingUrl : null).toBe('https://book.nylas.com/eu/test-client-id/jane');
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
      grantId: 'grant-123',
    });
    expect(result?.configId).toBeNull();
  });
});
