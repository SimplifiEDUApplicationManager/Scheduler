import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/types/database';

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
