import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';

const VALID_CONFIDENCE = ['HIGH', 'MEDIUM', 'UNPROVEN', 'LOW'] as const;
type Confidence = typeof VALID_CONFIDENCE[number];

/**
 * POST /api/tutor-subjects/[id]/grade
 * Coordinator sets the confidence level on a tutor's subject claim.
 * [id] is the tutor_subjects row id.
 * Body: { confidence: 'HIGH' | 'MEDIUM' | 'UNPROVEN' | 'LOW' }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveRole(['COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const { confidence } = body;

  if (!confidence) {
    return NextResponse.json({ error: 'Missing required field: confidence', status: 400 }, { status: 400 });
  }

  if (!VALID_CONFIDENCE.includes(confidence as Confidence)) {
    return NextResponse.json(
      { error: `confidence must be one of: ${VALID_CONFIDENCE.join(', ')}`, status: 400 },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from('tutor_subjects')
    .select('id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Subject claim not found', status: 404 }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('tutor_subjects')
    .update({ coordinator_confidence: confidence as Confidence, graded_by: user.id })
    .eq('id', id)
    .select('id, coordinator_confidence, graded_by')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, status: 500 }, { status: 500 });
  }

  return NextResponse.json(data);
}
