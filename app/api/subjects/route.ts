import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireActiveRole } from '@/lib/auth';

/**
 * GET /api/subjects
 * Returns all subjects, sorted by category then name.
 * Accessible to any authenticated user.
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, category')
    .order('category')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/subjects
 * Coordinator creates a new subject in the master list.
 * Body: { name, category }
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const body = await req.json() as Record<string, unknown>;
  const { name, category } = body;

  if (!name || !category) {
    return NextResponse.json({ error: 'Missing required fields: name, category', status: 400 }, { status: 400 });
  }

  if (typeof name !== 'string' || typeof category !== 'string') {
    return NextResponse.json({ error: 'name and category must be strings', status: 400 }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('subjects')
    .insert({ name: name.trim(), category: category.trim() })
    .select('id, name, category')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A subject with that name already exists', status: 409 }, { status: 409 });
    }
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
