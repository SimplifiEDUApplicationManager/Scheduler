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
    .select('id, name, category, level')
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
  const { name, category, level } = body;

  if (!name || !category || !level) {
    return NextResponse.json({ error: 'Missing required fields: name, category, level', status: 400 }, { status: 400 });
  }

  if (typeof name !== 'string' || typeof category !== 'string' || typeof level !== 'string') {
    return NextResponse.json({ error: 'name, category, and level must be strings', status: 400 }, { status: 400 });
  }

  const VALID_LEVELS = ['Middle School', 'High School', 'AP', 'IB', 'College'];
  if (!VALID_LEVELS.includes(level)) {
    return NextResponse.json({ error: `level must be one of: ${VALID_LEVELS.join(', ')}`, status: 400 }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('subjects')
    .insert({ name: name.trim(), category: category.trim(), level })
    .select('id, name, category, level')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A subject with that name and level already exists', status: 409 }, { status: 409 });
    }
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
