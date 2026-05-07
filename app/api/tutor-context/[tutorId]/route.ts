import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireActiveRole } from '@/lib/auth';
import type { Json } from '@/lib/types/database';

type Params = { params: Promise<{ tutorId: string }> };

/**
 * GET /api/tutor-context/[tutorId]
 * Returns the coordinator-managed context for a tutor.
 * Any authenticated user can read.
 */
export async function GET(
  _req: NextRequest,
  { params }: Params,
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { tutorId } = await params;

  const { data } = await supabase
    .from('tutor_context')
    .select('context')
    .eq('tutor_id', tutorId)
    .single();

  // Return empty context if no row exists yet — not an error.
  return NextResponse.json({ context: data?.context ?? {} });
}

/**
 * PUT /api/tutor-context/[tutorId]
 * Coordinator upserts the context JSONB for a tutor.
 * Body: { context: Record<string, unknown> }
 * Coordinator/SuperAdmin only.
 */
export async function PUT(
  req: NextRequest,
  { params }: Params,
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { tutorId } = await params;
  const body = await req.json() as Record<string, unknown>;

  if (!body.context || typeof body.context !== 'object' || Array.isArray(body.context)) {
    return NextResponse.json({ error: 'context must be a JSON object', status: 400 }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tutor_context')
    .upsert(
      { tutor_id: tutorId, context: body.context as Json, updated_by: user.id },
      { onConflict: 'tutor_id' },
    )
    .select('context')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ context: data.context });
}
