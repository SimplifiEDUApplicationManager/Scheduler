import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

/** GET — fetch all overrides for the authenticated tutor. */
export async function GET() {
  const auth = await requireActiveRole(['TUTOR', 'COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from('event_overrides')
    .select('nylas_event_id, master_event_id, counted')
    .eq('user_id', auth.user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

/**
 * POST — upsert an override for a single event or recurring series.
 * Body: { nylas_event_id: string, master_event_id?: string, counted: boolean }
 */
export async function POST(request: NextRequest) {
  const auth = await requireActiveRole(['TUTOR', 'COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;

  const body = await request.json() as {
    nylas_event_id?: string;
    master_event_id?: string | null;
    counted?: boolean;
  };

  if (!body.nylas_event_id || typeof body.counted !== 'boolean') {
    return NextResponse.json({ error: 'nylas_event_id and counted are required' }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from('event_overrides')
    .upsert(
      {
        user_id: auth.user.id,
        nylas_event_id: body.nylas_event_id,
        master_event_id: body.master_event_id ?? null,
        counted: body.counted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,nylas_event_id' },
    );

  if (error) {
    return NextResponse.json({ error: 'Failed to save override' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
