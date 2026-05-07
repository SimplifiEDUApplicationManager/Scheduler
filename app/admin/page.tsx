import { COORDINATORS, COORDINATOR_INVITES } from '@/lib/data/mock';
import { getCoordinators } from '@/lib/data/coordinators';
import { AdminClient } from '@/components/features/admin/AdminClient';
import { DEV_BYPASS } from '@/lib/env';

export default async function AdminPage() {
  if (DEV_BYPASS) {
    return <AdminClient coordinators={COORDINATORS} invites={COORDINATOR_INVITES} />;
  }

  const { coordinators, invites } = await getCoordinators();
  return <AdminClient coordinators={coordinators} invites={invites} />;
}
