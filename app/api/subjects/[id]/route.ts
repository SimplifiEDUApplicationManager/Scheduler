import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

/**
 * PATCH /api/subjects/[id]
 * Coordinator updates a subject's name or category.
 * Body: { name?, category? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const updates: { name?: string; category?: string } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name must be a string', status: 400 }, { status: 400 });
    }
    updates.name = (body.name as string).trim();
  }

  if (body.category !== undefined) {
    if (typeof body.category !== 'string') {
      return NextResponse.json({ error: 'category must be a string', status: 400 }, { status: 400 });
    }
    updates.category = (body.category as string).trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update', status: 400 }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('subjects')
    .update(updates)
    .eq('id', id)
    .select('id, name, category')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Subject not found', status: 404 }, { status: 404 });
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A subject with that name already exists', status: 409 }, { status: 409 });
    }
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/subjects/[id]
 * Coordinator removes a subject from the master list.
 * Fails with 409 if any tutors still have this subject.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await params;

  // Check if any tutors still have this subject assigned
  const { count } = await supabase
    .from('tutor_subjects')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} tutor(s) still have this subject`, status: 409 },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ id });
}
