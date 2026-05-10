import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { getAsanaMe, listAsanaProjects } from '@/lib/asana/client';

/**
 * POST /api/coordinator/asana/validate
 * Validates a PAT and returns the coordinator's Asana workspaces + projects.
 * Does NOT persist anything — used during the connection flow to populate the
 * project picker before the coordinator commits.
 *
 * Body: { pat: string }
 * Returns: { workspaces: [{gid, name}], projects: [{gid, name}] }
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const { pat } = body;

  if (typeof pat !== 'string' || pat.trim().length < 10) {
    return NextResponse.json({ error: 'A valid Asana PAT is required' }, { status: 400 });
  }

  const meResult = await getAsanaMe(pat.trim());
  if (!meResult.ok) {
    return NextResponse.json({ error: meResult.error }, { status: 422 });
  }

  const { workspaces } = meResult.data;
  if (!workspaces.length) {
    return NextResponse.json({ error: 'No Asana workspaces found for this token' }, { status: 422 });
  }

  // Fetch projects from the first workspace. For most teams this is the only one.
  // If coordinators need multi-workspace support this can be extended later.
  const primaryWorkspace = workspaces[0]!;
  const projectsResult = await listAsanaProjects(pat.trim(), primaryWorkspace.gid);
  if (!projectsResult.ok) {
    return NextResponse.json({ error: projectsResult.error }, { status: 422 });
  }

  return NextResponse.json({
    workspaces,
    projects: projectsResult.data.map(p => ({ gid: p.gid, name: p.name })),
  });
}
