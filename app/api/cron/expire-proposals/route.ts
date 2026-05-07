import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { expireOverdueProposals } from '@/lib/data/proposals';

export async function GET() {
  const supabase = await createClient();

  try {
    const expired = await expireOverdueProposals(supabase);
    return NextResponse.json({ expired });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
