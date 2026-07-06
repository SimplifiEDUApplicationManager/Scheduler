// Nylas OAuth helpers — shared by /api/nylas/auth and /api/nylas/oauth/callback.
//
// Owns the three things both routes need:
//   1. Shared config (callback URI, API base URI) — defined once, can't drift.
//   2. State encoding / decoding — paired so format changes stay in one place.
//   3. Token exchange — the highest-complexity step, behind a typed result seam.

// ── Config ───────────────────────────────────────────────────────────────────

/** The OAuth redirect URI Nylas will call after the user authorises. */
export function nylasCallbackUri(): string {
  const base = (process.env.SIMPLIFI_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://simplifischedule.app').replace(/\/$/, '');
  return `${base}/api/nylas/oauth/callback`;
}

/** The Nylas API base URL (region-specific). */
export function nylasApiUri(): string {
  return process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com';
}

// ── State encoding ────────────────────────────────────────────────────────────

/** Minimal representation of a working-hour window, mirroring the Nylas OpenHours type. */
export interface OAuthOpenHours {
  days: number[];    // 0=Sun, 1=Mon … 6=Sat
  start: string;     // "HH:MM"
  end: string;       // "HH:MM"
}

interface OAuthState {
  userId: string;
  openHours?: OAuthOpenHours[];
  cushionMinutes?: number;
}

/** Encode userId (+ optional scheduling prefs) into the OAuth `state` param. */
export function encodeOAuthState(
  userId: string,
  openHours?: OAuthOpenHours[],
  cushionMinutes?: number,
): string {
  const payload: OAuthState = { userId };
  if (openHours && openHours.length > 0) payload.openHours = openHours;
  if (cushionMinutes && cushionMinutes > 0) payload.cushionMinutes = cushionMinutes;
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export type DecodeStateResult =
  | { ok: true; userId: string; openHours?: OAuthOpenHours[]; cushionMinutes?: number }
  | { ok: false };

/** Decode the `state` param returned by Nylas. Returns ok:false if malformed. */
export function decodeOAuthState(state: string): DecodeStateResult {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as Partial<OAuthState>;
    if (!decoded.userId) return { ok: false };
    return {
      ok: true,
      userId: decoded.userId,
      openHours: decoded.openHours,
      cushionMinutes: decoded.cushionMinutes,
    };
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
    const body = await res.text();
    console.error('Nylas token exchange failed:', res.status, body, 'redirect_uri:', nylasCallbackUri());
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
