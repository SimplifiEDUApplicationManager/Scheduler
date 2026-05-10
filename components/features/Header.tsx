'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils/cn';
import { LogoutButton } from '@/components/features/LogoutButton';
import {
  NAV_TABS,
  ROLE_DEMO_USER,
  ROLE_HOME,
  ROLE_LABEL,
  UserRole,
} from '@/lib/types/roles';
import { DEV_BYPASS } from '@/lib/env';

export interface AuthUser {
  name: string;
  email: string;
  /** Which nav set to render — determined by the layout, not the DB role. */
  navRole: UserRole;
}

const ROLES: UserRole[] = ['coordinator', 'tutor', 'admin'];
const STORAGE_KEY = 'simplifi_role';

export function Header({ authUser }: { authUser?: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();

  // ── Dev bypass: localStorage role switcher ──────────────────────────────────
  const [devRole, setDevRole] = useState<UserRole>('coordinator');
  useEffect(() => {
    if (!DEV_BYPASS) return;
    const stored = localStorage.getItem(STORAGE_KEY) as UserRole | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored && ROLES.includes(stored)) setDevRole(stored);
  }, []);

  function switchRole(next: UserRole) {
    setDevRole(next);
    localStorage.setItem(STORAGE_KEY, next);
    router.push(ROLE_HOME[next]);
  }

  // ── Resolve display values ──────────────────────────────────────────────────
  const role: UserRole = DEV_BYPASS ? devRole : (authUser?.navRole ?? 'coordinator');
  const tabs = NAV_TABS[role];
  const logoHref = DEV_BYPASS ? ROLE_HOME[role] : (authUser ? ROLE_HOME[authUser.navRole] : '/');

  const displayEmail    = DEV_BYPASS ? ROLE_DEMO_USER[devRole].email    : (authUser?.email ?? '');
  const displayInitials = DEV_BYPASS ? ROLE_DEMO_USER[devRole].initials : initials(authUser?.name ?? '');

  // Most-specific match wins: /dashboard/tutors beats /dashboard
  const activeHref = tabs
    .filter(t => pathname === t.href || (t.href !== '/' && pathname.startsWith(t.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <header className="h-14 bg-surface-1 border-b border-border-default flex items-center px-5 gap-4 shrink-0 z-40">
      {/* Logo */}
      <Link href={logoHref} className="flex items-center gap-2.5 shrink-0">
        <Image src="/simplifilogo.png" alt="Simplifi" width={28} height={28} priority />
        <span className="text-body font-bold tracking-tight text-fg-1">Simplifi EDU</span>
      </Link>

      {/* Role switcher — dev only */}
      {DEV_BYPASS && (
        <div className="flex items-center p-0.5 bg-surface-3 rounded-lg shrink-0 ml-3">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => switchRole(r)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                r === devRole
                  ? 'bg-surface-1 text-fg-1 shadow-xs'
                  : 'text-fg-3 hover:text-fg-2',
              )}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      )}

      {/* Nav tabs */}
      <nav className="flex items-center gap-0.5 ml-3">
        {tabs.map(({ label, href }) => {
          const isActive = href === activeHref;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-surface-3 text-fg-1 font-semibold'
                  : 'text-fg-3 font-medium hover:text-fg-2 hover:bg-surface-3',
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs font-medium text-fg-1 leading-none">{displayEmail}</p>
          <p className="text-xxs text-fg-muted mt-0.5">{ROLE_LABEL[role]}</p>
        </div>
        <Avatar initials={displayInitials} tone="brand" size="md" />
        <LogoutButton />
      </div>
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0]!.toUpperCase())
    .slice(0, 2)
    .join('');
}
