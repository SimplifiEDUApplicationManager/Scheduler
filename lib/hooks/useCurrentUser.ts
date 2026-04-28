'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ActiveUser } from '@/lib/auth';

/**
 * Discriminated union with four distinct states:
 *   loading    — initial fetch in progress
 *   unauthenticated — no active session (not an error)
 *   user       — authenticated and row fetched
 *   error      — authenticated but DB fetch failed
 */
type UseCurrentUserResult =
  | { status: 'loading'; user: null; error: null }
  | { status: 'unauthenticated'; user: null; error: null }
  | { status: 'authenticated'; user: ActiveUser; error: null }
  | { status: 'error'; user: null; error: string };

/**
 * Client-side hook for reading the current authenticated user.
 *
 * Fetches the user's row from public.users and re-fetches on auth state changes
 * (sign-in, sign-out, token refresh). Does NOT redirect — use getCurrentUser()
 * in Server Components when a redirect is required.
 *
 * onAuthStateChange fires INITIAL_SESSION immediately on subscription, so no
 * explicit initial fetch is needed.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [state, setState] = useState<UseCurrentUserResult>({
    status: 'loading',
    user: null,
    error: null,
  });

  useEffect(() => {
    const supabase = createClient();

    async function fetchUser() {
      setState({ status: 'loading', user: null, error: null });

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setState({ status: 'unauthenticated', user: null, error: null });
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, status')
        .eq('id', authUser.id)
        .single();

      if (error || !data) {
        setState({ status: 'error', user: null, error: error?.message ?? 'User not found' });
        return;
      }

      setState({ status: 'authenticated', user: data, error: null });
    }

    // onAuthStateChange fires INITIAL_SESSION immediately — no need for a separate fetchUser() call.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
