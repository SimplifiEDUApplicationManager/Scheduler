import { redirect } from 'next/navigation';
import { Header } from '@/components/features/Header';
import { DEV_BYPASS } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  if (DEV_BYPASS) {
    return (
      <>
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', user.id)
    .single();

  if (!row) redirect('/login');

  return (
    <>
      <Header authUser={{ name: row.name, email: row.email, navRole: 'coordinator' }} />
      <main className="flex-1 overflow-auto">{children}</main>
    </>
  );
}
