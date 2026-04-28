'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ActiveUser } from '@/lib/auth';

type UseCurrentUserResult =
  | { user: ActiveUser; loading: false; error: null }
  | { user: null; loading: true; error: null }
  | { user: null; loading: false; error: string | null };

/**
 * Client-side hook for reading the current authenticated user.
 *
 * Fetches the user's row from public.users and re-fetches on auth state changes
 * (sign-in, sign-out, token refresh). Does NOT redirect — use getCurrentUser()
 * in Server Components when a redirect is required.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [state, setState] = useState<UseCurrentUserResult>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const supabase = createClient();

    async function fetchUser() {
      setState({ user: null, loading: true, error: null });

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setState({ user: null, loading: false, error: null });
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, status')
        .eq('id', authUser.id)
        .single();

      if (error || !data) {
        setState({ user: null, loading: false, error: error?.message ?? 'User not found' });
        return;
      }

      setState({ user: data, loading: false, error: null });
    }

    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
