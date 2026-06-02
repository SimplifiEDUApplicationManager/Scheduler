'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Handles two Supabase auth callback flows:
//   PKCE (user-initiated via login form):   ?code=<auth_code>&next=<path>
//   Implicit (admin-generated invite links): #access_token=<token>&refresh_token=<token>
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const nextParam = urlParams.get('next') ?? '/';
    const next =
      nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

    const finish = (ok: boolean) => router.replace(ok ? next : '/login?error=auth');

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => finish(!error));
    } else {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => finish(!error));
      } else {
        finish(false);
      }
    }
  }, [router]);

  return null;
}
