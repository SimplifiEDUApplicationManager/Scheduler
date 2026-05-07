// Coordinator management operations — state + mutations for the admin panel.
//
// Owns coords and invites state. Each mutation returns a human-readable message
// string so the caller (CoordinatorsPage) can decide whether and how to surface
// it (e.g. pushToast(sendInvite(data))).
//
// UI state — showInvite, confirm dialog, toast visibility — stays in the page
// component since it has no business logic.

import { useState } from 'react';
import type { Coordinator, CoordinatorInvite } from '@/lib/types/domain';

export function useCoordinators(
  initialCoords: Coordinator[],
  initialInvites: CoordinatorInvite[],
) {
  const [coords,  setCoords]  = useState(initialCoords);
  const [invites, setInvites] = useState(initialInvites);

  function sendInvite(data: { email: string; name: string; region: string; message: string }): string {
    const inv: CoordinatorInvite = {
      id:        `cinv-${Date.now()}`,
      ...data,
      invitedBy: 'You',
      sentAt:    'just now',
      expiresIn: '7 days',
      status:    'pending',
    };
    setInvites(prev => [inv, ...prev]);
    return `Invite sent to ${data.email}`;
  }

  function resendInvite(id: string): string {
    const inv = invites.find(i => i.id === id);
    setInvites(prev => prev.map(i =>
      i.id === id ? { ...i, sentAt: 'just now', expiresIn: '7 days', warning: null } : i,
    ));
    return `Invite to ${inv?.email} resent`;
  }

  function revokeInvite(id: string): string {
    const inv = invites.find(i => i.id === id);
    setInvites(prev => prev.filter(i => i.id !== id));
    return `Invite to ${inv?.email} revoked`;
  }

  function deactivate(id: string): string {
    const c = coords.find(x => x.id === id);
    setCoords(prev => prev.map(x =>
      x.id === id
        ? { ...x, status: 'inactive', deactivatedAt: 'just now', deactivatedReason: 'Deactivated by admin', activeTutors: 0, activeStudents: 0, openRequests: 0 }
        : x,
    ));
    return `${c?.name} deactivated`;
  }

  function reactivate(id: string): string {
    const c = coords.find(x => x.id === id);
    setCoords(prev => prev.map(x =>
      x.id === id ? { ...x, status: 'active', deactivatedAt: null, deactivatedReason: null } : x,
    ));
    return `${c?.name} reactivated`;
  }

  return { coords, invites, sendInvite, resendInvite, revokeInvite, deactivate, reactivate };
}
