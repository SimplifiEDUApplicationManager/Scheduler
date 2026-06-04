import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Tables, Database } from '@/lib/types/database';

// ── Skill bearer-token auth ───────────────────────────────────────────────────
//
// API routes that need to be callable from Claude skills accept an alternative
// auth path: Authorization: Bearer $SKILL_API_KEY.
// When the token matches, the request is treated as the bound coordinator
// (SKILL_COORDINATOR_ID) using a service-role Supabase client.

async function resolveSkillCaller(): Promise<
  { ok: true; user: { id: string }; supabase: ReturnType<typeof createServiceClient>; role: Role } | null
> {
  const apiKey = process.env.SKILL_API_KEY;
  const coordinatorId = process.env.SKILL_COORDINATOR_ID;
  if (!apiKey || !coordinatorId) return null;

  const headerStore = await headers();
  const auth = headerStore.get('authorization') ?? '';
  if (auth !== `Bearer ${apiKey}`) return null;

  const supabase = createServiceClient();
  const { data: caller } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', coordinatorId)
    .single();

  if (!caller || caller.status !== 'ACTIVE') return null;
  if (caller.role !== 'COORDINATOR' && caller.role !== 'SUPER_ADMIN') return null;

  return { ok: true, user: { id: coordinatorId }, supabase, role: caller.role as Role };
}

// ── Route auth helpers ───────────────────────────────────────────────────────
//
// Two helpers for API routes:
//   requireAuth()             — verifies the session only (no DB round-trip).
//                               Use for reads open to any authenticated user.
//   requireActiveRole(roles)  — verifies session + fetches caller row + enforces
//                               role membership and ACTIVE status.
//                               Use for writes and role-gated operations.
//
// Both helpers create the Supabase client internally. The same instance is
// returned in the success branch for use in subsequent queries.

type SupabaseInstance = ReturnType<typeof createServerClient<Database>>;

export type Role = 'TUTOR' | 'COORDINATOR' | 'SUPER_ADMIN';

export type AuthOk = {
  ok: true;
  user: { id: string };
  supabase: SupabaseInstance;
};

export type CallerOk = AuthOk & { role: Role };

type AuthFail = { ok: false; response: NextResponse };

/** Verify the session only. No DB round-trip to fetch the caller row. */
export async function requireAuth(): Promise<AuthOk | AuthFail> {
  const skill = await resolveSkillCaller();
  if (skill) return { ok: true, user: skill.user, supabase: skill.supabase };

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true, user: { id: user.id }, supabase };
}

/**
 * Verify the session, fetch the caller row, and enforce role + ACTIVE status.
 * Returns a typed CallerOk (with role) on success so routes can branch on role
 * for fine-grained ownership checks without a second DB query.
 */
export async function requireActiveRole(roles: readonly Role[]): Promise<CallerOk | AuthFail> {
  const skill = await resolveSkillCaller();
  if (skill) {
    if (!(roles as readonly string[]).includes(skill.role)) {
      return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return skill;
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: caller } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (!caller || !(roles as readonly string[]).includes(caller.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (caller.status !== 'ACTIVE') {
    return { ok: false, response: NextResponse.json({ error: 'Account is not active' }, { status: 403 }) };
  }

  return { ok: true, user: { id: user.id }, role: caller.role as Role, supabase };
}

// ── Server Component auth helper ─────────────────────────────────────────────

export type ActiveUser = Pick<Tables<'users'>, 'id' | 'email' | 'name' | 'role' | 'status'>;

/**
 * Server-side auth helper — use in Server Components and Route Handlers.
 *
 * 1. Verifies the session JWT against Supabase Auth (getUser, not getSession).
 * 2. Fetches the matching row from public.users.
 * 3. Redirects non-authenticated callers to /login.
 * 4. Redirects PENDING users to /onboarding.
 * 5. Redirects DISABLED users to /auth/disabled.
 *
 * Returns the user row only when status === 'ACTIVE'.
 */
export async function getCurrentUser(): Promise<ActiveUser> {
  const supabase = await createClient();

  // getUser() validates the JWT with Supabase Auth servers — safe for server-side use.
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    redirect('/login');
  }

  const { data: userRow, error: dbError } = await supabase
    .from('users')
    .select('id, email, name, role, status')
    .eq('id', authUser.id)
    .single();

  if (dbError || !userRow) {
    // Auth user exists but no public.users row — treat as unauthenticated.
    redirect('/login');
  }

  if (userRow.status === 'PENDING') {
    redirect('/onboarding');
  }

  if (userRow.status === 'DISABLED') {
    redirect('/auth/disabled');
  }

  // Positive guard: catches any future status values not explicitly handled above.
  if (userRow.status !== 'ACTIVE') {
    redirect('/login');
  }

  return userRow;
}
