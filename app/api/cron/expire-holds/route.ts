import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/cron/expire-holds
 * Flips ACTIVE holds whose expires_at has passed to EXPIRED.
 * Invoked hourly by Vercel Cron (see vercel.json).
 *
 * Protected by CRON_SECRET — Vercel passes:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }
  }

  // Service client bypasses RLS — required because the cron has no user session.
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('holds')
    .update({ status: 'EXPIRED' })
    .eq('status', 'ACTIVE')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json({ expired: data?.length ?? 0 });
}
