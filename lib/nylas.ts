// Nylas OAuth helpers — shared by /api/nylas/auth and /api/nylas/callback.
//
// Owns the three things both routes need:
//   1. Shared config (callback URI, API base URI) — defined once, can't drift.
//   2. State encoding / decoding — paired so format changes stay in one place.
//   3. Token exchange — the highest-complexity step, behind a typed result seam.

// ── Config ───────────────────────────────────────────────────────────────────

/** The OAuth redirect URI Nylas will call after the user authorises. */
export function nylasCallbackUri(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://simplifi-scheduler.vercel.app'}/api/nylas/callback`;
}

/** The Nylas API base URL (region-specific). */
export function nylasApiUri(): string {
  return process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com';
}

// ── State encoding ────────────────────────────────────────────────────────────

interface OAuthState {
  userId: string;
}

/** Encode userId into the OAuth `state` param (base64url JSON). */
export function encodeOAuthState(userId: string): string {
  return Buffer.from(JSON.stringify({ userId } satisfies OAuthState)).toString('base64url');
}

export type DecodeStateResult =
  | { ok: true; userId: string }
  | { ok: false };

/** Decode the `state` param returned by Nylas. Returns ok:false if malformed. */
export function decodeOAuthState(state: string): DecodeStateResult {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as Partial<OAuthState>;
    if (!decoded.userId) return { ok: false };
    return { ok: true, userId: decoded.userId };
  } catch {
    return { ok: false };
  }
}

// ── Token exchange ────────────────────────────────────────────────────────────

export type ExchangeResult =
  | { ok: true; grantId: string }
  | { ok: false; error: 'token_exchange_failed' | 'no_grant_id' };

/**
 * Exchange an authorisation code for a Nylas grant_id.
 * Handles both response shapes Nylas has been observed to return:
 *   { grant_id: "..." }  and  { data: { grant_id: "..." } }
 */
export async function exchangeCodeForGrant(code: string): Promise<ExchangeResult> {
  const res = await fetch(`${nylasApiUri()}/v3/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.NYLAS_CLIENT_ID,
      client_secret: process.env.NYLAS_CLIENT_SECRET,
      code,
      redirect_uri:  nylasCallbackUri(),
      grant_type:    'authorization_code',
    }),
  });

  if (!res.ok) {
    console.error('Nylas token exchange failed:', await res.text());
    return { ok: false, error: 'token_exchange_failed' };
  }

  const data = await res.json() as Record<string, unknown>;
  const grantId = (data.grant_id ?? (data.data as Record<string, unknown> | undefined)?.grant_id) as string | undefined;

  if (!grantId) {
    console.error('No grant_id in Nylas token response:', data);
    return { ok: false, error: 'no_grant_id' };
  }

  return { ok: true, grantId };
}
