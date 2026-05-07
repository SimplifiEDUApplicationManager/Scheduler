// Coordinator data module — owns all Supabase queries for the admin panel.
//
// getCoordinators() is the single place that knows how to fetch coordinator
// rows and map them to the Coordinator / CoordinatorInvite domain types.
// The admin Server Component calls this; it never touches Supabase directly.

import { createServiceClient } from '@/lib/supabase/server';
import type { Coordinator, CoordinatorInvite } from '@/lib/types/domain';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface CoordinatorData {
  coordinators: Coordinator[];
  invites: CoordinatorInvite[];
}

export async function getCoordinators(): Promise<CoordinatorData> {
  const supabase = createServiceClient();

  const { data: rows, error } = await supabase
    .from('users')
    .select('id, email, name, role, status, region, invited_by, created_at, updated_at')
    .eq('role', 'COORDINATOR')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch coordinators: ${error.message}`);

  const coordinators: Coordinator[] = (rows ?? [])
    .filter(r => r.status === 'ACTIVE' || r.status === 'DISABLED')
    .map(r => ({
      id:               r.id,
      initials:         initials(r.name ?? r.email),
      name:             r.name ?? r.email,
      email:            r.email,
      region:           r.region ?? '',
      role:             'Coordinator',
      status:           r.status === 'ACTIVE' ? 'active' : 'inactive',
      activeTutors:     0,
      activeStudents:   0,
      openRequests:     0,
      lastActive:       relativeTime(r.updated_at ?? r.created_at),
      deactivatedAt:    r.status === 'DISABLED' ? relativeTime(r.updated_at ?? r.created_at) : null,
      deactivatedReason: r.status === 'DISABLED' ? 'Deactivated by admin' : null,
    }));

  const invites: CoordinatorInvite[] = (rows ?? [])
    .filter(r => r.status === 'PENDING')
    .map(r => {
      const createdAt  = new Date(r.created_at);
      const expiresAt  = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      const daysLeft   = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
      const expiredStr = daysLeft > 0
        ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
        : 'expired';
      return {
        id:        r.id,
        name:      r.name ?? '',
        email:     r.email,
        region:    r.region ?? '',
        invitedBy: 'Admin',
        sentAt:    relativeTime(r.created_at),
        expiresIn: expiredStr,
        status:    'pending' as const,
        warning:   daysLeft <= 1 ? 'Expires soon — resend to extend.' : null,
      };
    });

  return { coordinators, invites };
}
