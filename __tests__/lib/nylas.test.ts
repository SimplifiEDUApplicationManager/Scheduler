import { describe, it, expect } from 'vitest';
import { encodeOAuthState, decodeOAuthState } from '@/lib/nylas';

// ── Behaviors 3 & 5: valid base64 JSON but wrong shape ───────────────────

describe('decodeOAuthState — wrong shape', () => {
  it('returns ok:false when userId field is absent', () => {
    const state = Buffer.from(JSON.stringify({ something: 'else' })).toString('base64url');
    expect(decodeOAuthState(state)).toEqual({ ok: false });
  });

  it('returns ok:false when userId is an empty string', () => {
    const state = Buffer.from(JSON.stringify({ userId: '' })).toString('base64url');
    expect(decodeOAuthState(state)).toEqual({ ok: false });
  });

  it('returns ok:false for an empty JSON object', () => {
    const state = Buffer.from('{}').toString('base64url');
    expect(decodeOAuthState(state)).toEqual({ ok: false });
  });
});

// ── Behavior 2: malformed input ──────────────────────────────────────────

describe('decodeOAuthState — malformed input', () => {
  it('returns ok:false for a non-base64 string', () => {
    expect(decodeOAuthState('!!!not-base64!!!')).toEqual({ ok: false });
  });

  it('returns ok:false for an empty string', () => {
    expect(decodeOAuthState('')).toEqual({ ok: false });
  });

  it('returns ok:false for valid base64 that is not JSON', () => {
    const notJson = Buffer.from('hello world').toString('base64url');
    expect(decodeOAuthState(notJson)).toEqual({ ok: false });
  });
});

// ── Behavior 1: round-trip fidelity ──────────────────────────────────────

describe('encodeOAuthState / decodeOAuthState — round-trip', () => {
  it('decode(encode(userId)) returns the original userId', () => {
    const userId = 'user-abc-123';
    const result = decodeOAuthState(encodeOAuthState(userId));
    expect(result).toEqual({ ok: true, userId });
  });

  it('preserves a UUID-shaped userId', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const result = decodeOAuthState(encodeOAuthState(userId));
    expect(result).toEqual({ ok: true, userId });
  });
});
