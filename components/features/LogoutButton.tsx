'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // refresh() invalidates the Next.js router cache so server components
    // re-run; push('/login') then lands the user on the login page.
    router.push('/login');
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} disabled={loading}>
      {loading ? 'Signing out\u2026' : 'Sign out'}
    </Button>
  );
}
