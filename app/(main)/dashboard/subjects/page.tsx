import { DEV_BYPASS } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { CoordinatorSubjectsClient } from '@/components/features/subjects/CoordinatorSubjectsClient';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export interface SubjectRow {
  id: string;
  name: string;
  category: string;
  tutorCount: number;
}

export interface TutorClaim {
  rowId: string;
  tutorId: string;
  tutorName: string;
  tutorInitials: string;
  tutorBio: string;
  /** Tutor's own self-reported confidence. */
  selfConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Coordinator's graded confidence. */
  coordConfidence: 'HIGH' | 'MEDIUM' | 'UNPROVEN' | 'LOW';
  qualificationNote: string;
  gradedBy: string | null;
}

export default async function SubjectsPage() {
  if (DEV_BYPASS) {
    return <CoordinatorSubjectsClient initialSubjects={[]} claimsBySubject={{}} />;
  }

  const supabase = await createClient();

  const [
    { data: subjectRows, error: subjectsError },
    { data: claimRows,   error: claimsError   },
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, category')
      .order('category')
      .order('name'),
    supabase
      .from('tutor_subjects')
      .select('id, confidence, coordinator_confidence, qualification_note, graded_by, subject_id, tutor_id, users!tutor_subjects_tutor_id_fkey(name, bio)')
      .order('created_at'),
  ]);

  if (subjectsError) throw subjectsError;
  if (claimsError)   throw claimsError;

  // Build map: subject_id → claims
  const claimsBySubject: Record<string, TutorClaim[]> = {};
  for (const row of claimRows ?? []) {
    const tutorInfo = row.users as { name: string; bio: string | null } | null;
    const name = tutorInfo?.name ?? 'Unknown';
    const claim: TutorClaim = {
      rowId:             row.id,
      tutorId:           row.tutor_id,
      tutorName:         name,
      tutorInitials:     initials(name),
      tutorBio:          tutorInfo?.bio ?? '',
      selfConfidence:    (row.confidence as TutorClaim['selfConfidence']) ?? 'HIGH',
      coordConfidence:   row.coordinator_confidence as TutorClaim['coordConfidence'],
      qualificationNote: row.qualification_note ?? '',
      gradedBy:          row.graded_by ?? null,
    };
    (claimsBySubject[row.subject_id] ??= []).push(claim);
  }

  const subjects: SubjectRow[] = (subjectRows ?? []).map(s => ({
    id:         s.id,
    name:       s.name,
    category:   s.category,
    tutorCount: claimsBySubject[s.id]?.length ?? 0,
  }));

  return (
    <CoordinatorSubjectsClient
      initialSubjects={subjects}
      claimsBySubject={claimsBySubject}
    />
  );
}
