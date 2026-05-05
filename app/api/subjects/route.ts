import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/subjects
 * Returns all subjects, sorted by category then name.
 * Accessible to any authenticated user.
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

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
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (!caller || !['COORDINATOR', 'SUPER_ADMIN'].includes(caller.role)) {
    return NextResponse.json({ error: 'Only coordinators can manage subjects', status: 403 }, { status: 403 });
  }

  if (caller.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account is not active', status: 403 }, { status: 403 });
  }

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
