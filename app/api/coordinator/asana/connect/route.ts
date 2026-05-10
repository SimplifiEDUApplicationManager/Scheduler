import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { getAsanaProject } from '@/lib/asana/client';

/**
 * POST /api/coordinator/asana/connect
 * Saves the coordinator's Asana PAT and chosen project GID.
 * Verifies the PAT can actually access the project before saving.
 *
 * Body: { pat: string, projectGid: string }
 * Returns: { projectGid: string, projectName: string }
 *
 * DB columns written: asana_access_token, asana_project_id
 * Note: asana_access_token requires a migration if not yet present:
 *   ALTER TABLE users ADD COLUMN IF NOT EXISTS asana_access_token text;
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const body = await req.json() as Record<string, unknown>;
  const { pat, projectGid } = body;

  if (typeof pat !== 'string' || pat.trim().length < 10) {
    return NextResponse.json({ error: 'A valid Asana PAT is required' }, { status: 400 });
  }
  if (typeof projectGid !== 'string' || !projectGid.trim()) {
    return NextResponse.json({ error: 'A project GID is required' }, { status: 400 });
  }

  // Confirm the token can access the chosen project before persisting.
  const projectResult = await getAsanaProject(pat.trim(), projectGid.trim());
  if (!projectResult.ok) {
    return NextResponse.json({ error: projectResult.error }, { status: 422 });
  }

  const { error } = await supabase
    .from('users')
    .update({
      asana_access_token: pat.trim(),
      asana_project_id:   projectGid.trim(),
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    projectGid:  projectResult.data.gid,
    projectName: projectResult.data.name,
  });
}
