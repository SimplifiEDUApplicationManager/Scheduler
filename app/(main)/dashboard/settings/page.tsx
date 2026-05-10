import { redirect } from 'next/navigation';
import { DEV_BYPASS } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { AsanaConnectionClient } from '@/components/features/coordinator/AsanaConnectionClient';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#18181B' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: '#71717A', margin: '4px 0 0', lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function CoordinatorSettingsPage() {
  if (DEV_BYPASS) {
    return (
      <div style={{ flex: 1, overflow: 'auto', background: '#FAFAFA' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 32px 80px' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.015em' }}>Settings</h1>
          <p style={{ fontSize: 13, color: '#71717A', margin: '0 0 24px' }}>Integrations and preferences for your coordinator account.</p>
          <Card title="Asana" subtitle="Connect your Asana account to pull tutoring requests directly into your dashboard. Each coordinator uses their own token and project.">
            <AsanaConnectionClient connected={false} projectName={null} />
          </Card>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: row } = await supabase
    .from('users')
    .select('asana_project_id, asana_access_token')
    .eq('id', user.id)
    .single();

  const connected    = !!(row?.asana_access_token && row?.asana_project_id);
  // Fetch project name from Asana if connected, fall back to project GID
  let projectName: string | null = null;
  if (connected) {
    try {
      const { getAsanaProject } = await import('@/lib/asana/client');
      const result = await getAsanaProject(row!.asana_access_token!, row!.asana_project_id!);
      projectName = result.ok ? result.data.name : row!.asana_project_id;
    } catch {
      projectName = row!.asana_project_id;
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 32px 80px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.015em' }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#71717A', margin: '0 0 24px' }}>Integrations and preferences for your coordinator account.</p>
        <Card title="Asana" subtitle="Connect your Asana account to pull tutoring requests directly into your dashboard. Each coordinator uses their own token and project.">
          <AsanaConnectionClient connected={connected} projectName={projectName} />
        </Card>
      </div>
    </div>
  );
}
