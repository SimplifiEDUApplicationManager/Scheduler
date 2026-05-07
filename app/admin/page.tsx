import { COORDINATORS, COORDINATOR_INVITES } from '@/lib/data/mock';
import { getCoordinators } from '@/lib/data/coordinators';
import { AdminClient } from '@/components/features/admin/AdminClient';

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true';

export default async function AdminPage() {
  if (DEV_BYPASS) {
    return <AdminClient coordinators={COORDINATORS} invites={COORDINATOR_INVITES} />;
  }

  const { coordinators, invites } = await getCoordinators();
  return <AdminClient coordinators={coordinators} invites={invites} />;
}
