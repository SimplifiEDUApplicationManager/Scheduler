import { COORDINATORS, COORDINATOR_INVITES } from '@/lib/data/mock';
import { AdminClient } from '@/components/features/admin/AdminClient';

export default function AdminPage() {
  return <AdminClient coordinators={COORDINATORS} invites={COORDINATOR_INVITES} />;
}
