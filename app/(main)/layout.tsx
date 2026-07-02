import { redirect } from 'next/navigation';
import { Header } from '@/components/features/Header';
import { DEV_BYPASS } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  if (DEV_BYPASS) {
    return (
      <>
        <Header />
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">{children}</main>
      </>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('users')
    .select('name, email, role, status, photo_url')
    .eq('id', user.id)
    .single();

  // No row (RLS block) or PENDING status — send to /onboarding, not /login,
  // to avoid the /login → / → /login redirect loop for invited users.
  if (!row || row.status === 'PENDING') redirect('/onboarding');

  return (
    <>
      <Header authUser={{ name: row.name, email: row.email, photoUrl: row.photo_url, navRole: 'coordinator', dbRole: row.role }} />
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">{children}</main>
    </>
  );
}
