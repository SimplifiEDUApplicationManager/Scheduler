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

const ROLES: UserRole[] = ['coordinator', 'tutor', 'admin'];
const STORAGE_KEY = 'simplifi_role';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();

  // Hydration-safe: default to coordinator, then read localStorage on mount
  const [role, setRole] = useState<UserRole>('coordinator');
  // Reading from localStorage on mount (external system → React state) is a valid
  // useEffect pattern for SSR-safe hydration. The rule fires a false positive here.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as UserRole | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored && ROLES.includes(stored)) setRole(stored);
  }, []);

  function switchRole(next: UserRole) {
    setRole(next);
    localStorage.setItem(STORAGE_KEY, next);
    router.push(ROLE_HOME[next]);
  }

  const tabs = NAV_TABS[role];
  const user = ROLE_DEMO_USER[role];

  return (
    <header className="h-14 bg-surface-1 border-b border-border-default flex items-center px-5 gap-4 shrink-0 z-40">
      {/* Logo */}
      <Link href={ROLE_HOME[role]} className="flex items-center gap-2.5 shrink-0">
        <Image src="/simplifilogo.png" alt="Simplifi" width={28} height={28} priority />
        <span className="text-body font-bold tracking-tight text-fg-1">Simplifi EDU</span>
      </Link>

      {/* Role switcher — segmented control */}
      <div className="flex items-center p-0.5 bg-surface-3 rounded-lg shrink-0 ml-3">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => switchRole(r)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
              r === role
                ? 'bg-surface-1 text-fg-1 shadow-xs'
                : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      {/* Nav tabs */}
      <nav className="flex items-center gap-0.5 ml-3">
        {tabs.map(({ label, href }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
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
          <p className="text-xs font-medium text-fg-1 leading-none">{user.email}</p>
          <p className="text-xxs text-fg-muted mt-0.5">{ROLE_LABEL[role]}</p>
        </div>
        <Avatar initials={user.initials} tone="brand" size="md" />
        <LogoutButton />
      </div>
    </header>
  );
}
