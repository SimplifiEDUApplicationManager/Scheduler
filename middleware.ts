import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types/database';

type UserRole = Database['public']['Enums']['user_role'];

/** Default redirect destination for each role. */
const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: '/dashboard',
  COORDINATOR: '/dashboard',
  TUTOR: '/tutor',
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Build a mutable response so cookie refreshes propagate to the browser.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies onto both the outgoing request and response so the
          // refreshed session is available to the route handler as well.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates the JWT with Supabase Auth servers — safe for middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Fetch role + status from public.users ──────────────────────────────────
  const { data: userRow } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (!userRow) {
    // Auth user exists but no public.users row — treat as unauthenticated.
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Status guards ──────────────────────────────────────────────────────────
  if (userRow.status === 'PENDING' && pathname !== '/onboarding') {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  if (userRow.status === 'DISABLED') {
    return NextResponse.redirect(new URL('/auth/disabled', request.url));
  }

  // ── Role-based route guards ────────────────────────────────────────────────
  const role = userRow.role;
  const home = ROLE_HOME[role] ?? '/';

  if (pathname.startsWith('/dashboard') && role !== 'COORDINATOR' && role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (pathname.startsWith('/tutor') && role !== 'TUTOR' && role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (pathname.startsWith('/admin') && role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/tutor/:path*', '/admin/:path*', '/onboarding/:path*'],
};
