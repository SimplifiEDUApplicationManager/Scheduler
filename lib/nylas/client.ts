// lib/nylas/client.ts
// Server-side only — NEVER import from 'use client' files or client components.
//
// Thin typed wrapper over the Nylas v3 REST API.
// All credentials are read from process.env inside functions so they are
// never bundled into client-side code.
//
// Response shape (Nylas v3):
//   Success  → { data: T, request_id: string }
//   List     → { data: T[], request_id: string, next_cursor?: string }
//   Error    → { error: { type: string, message: string }, request_id: string }

// ── Config ────────────────────────────────────────────────────────────────────

interface NylasConfig {
  apiKey: string;
  apiUri: string;
}

function getNylasConfig(): NylasConfig {
  const apiKey = process.env.NYLAS_API_KEY;
  if (!apiKey) throw new Error('Missing env var: NYLAS_API_KEY');
  return {
    apiKey,
    apiUri: process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com',
  };
}

// ── Response types ────────────────────────────────────────────────────────────

export interface NylasSingleResponse<T> {
  data: T;
  request_id: string;
}

export interface NylasListResponse<T> {
  data: T[];
  request_id: string;
  next_cursor?: string;
}

export interface NylasErrorResponse {
  error: {
    type: string;
    message: string;
  };
  request_id: string;
}

export type NylasResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: string; statusCode: number; requestId: string };

export type NylasListResult<T> =
  | { ok: true; data: T[]; requestId: string; nextCursor?: string }
  | { ok: false; error: string; statusCode: number; requestId: string };

// ── Base request ──────────────────────────────────────────────────────────────

async function nylasRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ raw: unknown; status: number; requestId: string }> {
  const { apiKey, apiUri } = getNylasConfig();

  const res = await fetch(`${apiUri}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const raw = res.status === 204 ? null : await res.json();
  const requestId =
    res.headers.get('x-request-id') ??
    ((raw as Record<string, unknown> | null)?.request_id as string | undefined) ??
    '';

  return { raw, status: res.status, requestId };
}

function extractError(raw: unknown, requestId: string, statusCode: number): { ok: false; error: string; statusCode: number; requestId: string } {
  const errorBody = raw as Partial<NylasErrorResponse> | null;
  const msg = errorBody?.error?.message ?? `Nylas API error`;
  return { ok: false, error: msg, statusCode, requestId };
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** GET a single resource. */
export async function nylasGet<T>(path: string): Promise<NylasResult<T>> {
  const { raw, status, requestId } = await nylasRequest('GET', path);
  if (status >= 400) return extractError(raw, requestId, status);
  return { ok: true, data: (raw as NylasSingleResponse<T>).data, requestId };
}

/** GET a list resource (supports pagination via next_cursor). */
export async function nylasList<T>(path: string): Promise<NylasListResult<T>> {
  const { raw, status, requestId } = await nylasRequest('GET', path);
  if (status >= 400) return extractError(raw, requestId, status);
  const typed = raw as NylasListResponse<T>;
  return { ok: true, data: typed.data, requestId, nextCursor: typed.next_cursor };
}

/** POST a resource. */
export async function nylasPost<T>(path: string, body: unknown): Promise<NylasResult<T>> {
  const { raw, status, requestId } = await nylasRequest('POST', path, body);
  if (status >= 400) return extractError(raw, requestId, status);
  return { ok: true, data: (raw as NylasSingleResponse<T>).data, requestId };
}

/** PUT a resource. */
export async function nylasPut<T>(path: string, body: unknown): Promise<NylasResult<T>> {
  const { raw, status, requestId } = await nylasRequest('PUT', path, body);
  if (status >= 400) return extractError(raw, requestId, status);
  return { ok: true, data: (raw as NylasSingleResponse<T>).data, requestId };
}

/** PATCH a resource (partial update). */
export async function nylasPatch<T>(path: string, body: unknown): Promise<NylasResult<T>> {
  const { raw, status, requestId } = await nylasRequest('PATCH', path, body);
  if (status >= 400) return extractError(raw, requestId, status);
  return { ok: true, data: (raw as NylasSingleResponse<T>).data, requestId };
}

/** DELETE a resource. Returns ok:true with data:null on 204. */
export async function nylasDelete(path: string): Promise<NylasResult<null>> {
  const { raw, status, requestId } = await nylasRequest('DELETE', path);
  if (status >= 400) return extractError(raw, requestId, status);
  return { ok: true, data: null, requestId };
}

// ── Grant-scoped path builder ─────────────────────────────────────────────────

/**
 * Build the base path for a grant-scoped resource.
 * Usage: grantPath(grantId, 'events') → '/v3/grants/{grantId}/events'
 */
export function grantPath(grantId: string, resource: string): string {
  return `/v3/grants/${grantId}/${resource}`;
}
