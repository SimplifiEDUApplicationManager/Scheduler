import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS === 'true') {
    redirect('/dashboard');
  }

  // If Supabase lands a magic-link code at the root URL (when redirect_to was
  // set to the site URL rather than /auth/callback), forward it to the callback.
  const { code } = await searchParams;
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userRow) {
    redirect('/login');
  }

  if (userRow.role === 'TUTOR') {
    redirect('/tutor/settings');
  }

  redirect('/dashboard');
}
