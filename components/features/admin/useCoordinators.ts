// Coordinator management operations — state + mutations for the admin panel.
//
// Owns coords and invites state. Each mutation awaits the API, updates local
// state on success, and returns a human-readable message string so the caller
// (CoordinatorsPage) can decide how to surface it (e.g. pushToast(await sendInvite(data))).
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

  async function sendInvite(data: {
    email: string;
    name: string;
    region: string;
    message: string;
  }): Promise<string> {
    const res = await fetch('/api/coordinators/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to send invite');

    const inv: CoordinatorInvite = {
      id:        json.id,
      name:      json.name,
      email:     data.email,
      region:    data.region,
      invitedBy: 'You',
      sentAt:    'just now',
      expiresIn: '7 days',
      status:    'pending',
    };
    setInvites(prev => [inv, ...prev]);
    return json.message as string;
  }

  async function resendInvite(id: string): Promise<string> {
    const inv = invites.find(i => i.id === id);
    const res = await fetch(`/api/coordinators/${id}/resend`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to resend invite');

    setInvites(prev => prev.map(i =>
      i.id === id ? { ...i, sentAt: 'just now', expiresIn: '7 days', warning: null } : i,
    ));
    return json.message ?? `Invite to ${inv?.email} resent`;
  }

  async function revokeInvite(id: string): Promise<string> {
    const inv = invites.find(i => i.id === id);
    const res = await fetch(`/api/coordinators/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to revoke invite');

    setInvites(prev => prev.filter(i => i.id !== id));
    return json.message ?? `Invite to ${inv?.email} revoked`;
  }

  async function deactivate(id: string): Promise<string> {
    const c = coords.find(x => x.id === id);
    const res = await fetch(`/api/coordinators/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DISABLED' }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to deactivate');

    setCoords(prev => prev.map(x =>
      x.id === id
        ? { ...x, status: 'inactive', deactivatedAt: 'just now', deactivatedReason: 'Deactivated by admin', activeTutors: 0, activeStudents: 0, openRequests: 0 }
        : x,
    ));
    return json.message ?? `${c?.name} deactivated`;
  }

  async function reactivate(id: string): Promise<string> {
    const c = coords.find(x => x.id === id);
    const res = await fetch(`/api/coordinators/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to reactivate');

    setCoords(prev => prev.map(x =>
      x.id === id ? { ...x, status: 'active', deactivatedAt: null, deactivatedReason: null } : x,
    ));
    return json.message ?? `${c?.name} reactivated`;
  }

  return { coords, invites, sendInvite, resendInvite, revokeInvite, deactivate, reactivate };
}
