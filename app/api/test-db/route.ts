import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/test-db
 * Smoke-test: reads auth.users count via the service-role client.
 * Remove this route before production.
 */
export async function GET() {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users_count: count });
}
