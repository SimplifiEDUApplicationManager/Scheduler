import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

/**
 * POST /api/coordinator/asana/disconnect
 * Clears the coordinator's Asana token and project from the DB.
 */
export async function POST() {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { error } = await supabase
    .from('users')
    .update({ asana_access_token: null, asana_project_id: null })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
