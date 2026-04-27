export type UserRole = 'coordinator' | 'tutor' | 'admin';

export interface NavTab {
  label: string;
  href: string;
}

export const NAV_TABS: Record<UserRole, NavTab[]> = {
  coordinator: [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Matcher', href: '/dashboard/tutors' },
    { label: 'Calendar', href: '/dashboard/calendar' },
    { label: 'Requests', href: '/dashboard/requests' },
    { label: 'Subjects', href: '/dashboard/subjects' },
    { label: 'Proposals', href: '/dashboard/proposals' },
  ],
  tutor: [
    { label: 'Calendar', href: '/tutor/calendar' },
    { label: 'Proposals', href: '/tutor/proposals' },
    { label: 'Subjects', href: '/tutor/subjects' },
    { label: 'Settings', href: '/tutor/settings' },
  ],
  admin: [{ label: 'Overview', href: '/admin' }],
};

// Where to land when switching to a role
export const ROLE_HOME: Record<UserRole, string> = {
  coordinator: '/dashboard',
  tutor: '/tutor/calendar',
  admin: '/admin',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  coordinator: 'Coordinator',
  tutor: 'Tutor',
  admin: 'Super Admin',
};

// Placeholder identities for pre-auth role switching (replaced by real auth in Phase 4)
export const ROLE_DEMO_USER: Record<UserRole, { name: string; email: string; initials: string }> = {
  coordinator: { name: 'Meg Adams', email: 'meg@simplifi.edu', initials: 'MA' },
  tutor: { name: 'Julia H.', email: 'julia@simplifi.edu', initials: 'JH' },
  admin: { name: 'Austin R.', email: 'austin@simplifiedu.com', initials: 'AR' },
};
