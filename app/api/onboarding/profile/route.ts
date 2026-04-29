import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * PATCH /api/onboarding/profile
 * Updates the tutor's display name and/or timezone during onboarding.
 * Also syncs the name to Supabase Auth user metadata.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { name?: string; timezone?: string };
  const { name, timezone } = body;

  if (!name && !timezone) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  // Sync name to Auth metadata so it's available in JWT
  if (name) {
    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: { full_name: name },
    });
    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 500 });
    }
  }

  // Write to public.users
  const { error: dbError } = await supabase
    .from('users')
    .update({
      ...(name     ? { name }     : {}),
      ...(timezone ? { timezone } : {}),
    })
    .eq('id', user.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
