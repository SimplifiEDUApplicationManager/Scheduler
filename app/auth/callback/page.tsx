'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Handles Supabase auth callback flows:
//   PKCE (user-initiated via login form):   ?code=<auth_code>&next=<path>
//   Implicit (admin-generated invite links): #access_token=<token>&refresh_token=<token>
//   Recovery (password reset):               #access_token=<token>&type=recovery
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));

    const code = urlParams.get('code');
    const nextParam = urlParams.get('next') ?? '/';
    let next =
      nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

    // If the hash indicates a recovery flow, force redirect to /reset-password
    const hashType = hashParams.get('type');
    if (hashType === 'recovery') {
      next = '/reset-password';
    }

    const finish = (ok: boolean) => router.replace(ok ? next : '/login?error=auth');

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => finish(!error));
    } else {
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => finish(!error));
      } else {
        // Fallback: listen for PASSWORD_RECOVERY event from Supabase client
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') {
            subscription.unsubscribe();
            router.replace('/reset-password');
          }
        });
        // If nothing fires within 3s, redirect to default
        setTimeout(() => { subscription.unsubscribe(); finish(false); }, 3000);
      }
    }
  }, [router]);

  return null;
}
