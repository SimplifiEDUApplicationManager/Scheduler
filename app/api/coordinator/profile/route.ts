import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

/**
 * GET /api/coordinator/profile
 * Returns the signed-in coordinator's profile settings needed by Claude skills.
 * Accepts session cookie OR Authorization: Bearer $SKILL_API_KEY.
 */
export async function GET() {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, asana_project_id, skill_api_key')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Profile not found', status: 404 }, { status: 404 });
  }

  return NextResponse.json(data);
}
