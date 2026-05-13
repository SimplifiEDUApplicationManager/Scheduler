/**
 * lib/asana/client.ts
 * Thin wrapper around the Asana REST API v1.
 * All calls are server-side only — PATs are never exposed to the browser.
 */

const BASE = 'https://app.asana.com/api/1.0';

type AsanaResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function asanaGet<T>(path: string, pat: string): Promise<AsanaResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json' },
      // No caching — PAT-validated calls should always be fresh
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'Network error reaching Asana' };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const msg = res.status === 401
      ? 'Invalid Asana token — check your PAT and try again'
      : res.status === 403
        ? 'Token lacks permission to access this resource'
        : `Asana error ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`;
    return { ok: false, error: msg };
  }

  try {
    const json = await res.json() as { data: T };
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: 'Unexpected response from Asana' };
  }
}

async function asanaPost<T>(path: string, pat: string, body: unknown): Promise<AsanaResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: body }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'Network error reaching Asana' };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `Asana error ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}` };
  }

  try {
    const json = await res.json() as { data: T };
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: 'Unexpected response from Asana' };
  }
}

async function asanaPut<T>(path: string, pat: string, body: unknown): Promise<AsanaResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: body }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'Network error reaching Asana' };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `Asana error ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}` };
  }

  try {
    const json = await res.json() as { data: T };
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: 'Unexpected response from Asana' };
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AsanaWorkspace {
  gid: string;
  name: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  workspace: { gid: string };
}


interface AsanaMe {
  gid: string;
  name: string;
  workspaces: AsanaWorkspace[];
}

interface AsanaComment {
  gid: string;
  text: string;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Validate a PAT and return the caller's workspaces.
 * Use this to confirm the token is valid before listing projects.
 */
export async function getAsanaMe(pat: string): Promise<AsanaResult<AsanaMe>> {
  return asanaGet<AsanaMe>('/users/me?opt_fields=gid,name,workspaces.gid,workspaces.name', pat);
}

/**
 * List all projects visible to this PAT in the given workspace.
 * Returns up to 100 projects (Asana default page size).
 */
export async function listAsanaProjects(
  pat: string,
  workspaceGid: string,
): Promise<AsanaResult<AsanaProject[]>> {
  return asanaGet<AsanaProject[]>(
    `/projects?workspace=${workspaceGid}&opt_fields=gid,name,workspace.gid&limit=100`,
    pat,
  );
}

/**
 * Fetch a single project by GID to verify the PAT has access.
 */
export async function getAsanaProject(
  pat: string,
  projectGid: string,
): Promise<AsanaResult<AsanaProject>> {
  return asanaGet<AsanaProject>(`/projects/${projectGid}?opt_fields=gid,name,workspace.gid`, pat);
}

/**
 * Add a comment to a task. Returns the story GID on success.
 */
export async function addAsanaComment(
  pat: string,
  taskGid: string,
  text: string,
): Promise<AsanaResult<AsanaComment>> {
  return asanaPost<AsanaComment>(`/tasks/${taskGid}/stories`, pat, { text });
}

/**
 * Mark a task as complete.
 */
export async function completeAsanaTask(
  pat: string,
  taskGid: string,
): Promise<AsanaResult<{ gid: string; completed: boolean }>> {
  return asanaPut<{ gid: string; completed: boolean }>(
    `/tasks/${taskGid}`,
    pat,
    { completed: true },
  );
}
