import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

/**
 * Browser Supabase client — safe to use in Client Components.
 * Uses the public anon key only; RLS enforces access rules.
 * Call once per component tree; do not use in Server Components or API routes.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
