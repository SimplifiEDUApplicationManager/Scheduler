import { DEV_BYPASS } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { CoordinatorSubjectsClient } from '@/components/features/subjects/CoordinatorSubjectsClient';
import type { SubjectConf, SubjectChangeType } from '@/lib/types/domain';

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
  level: string;
  tutorCount: number;
}

export interface TutorClaim {
  rowId: string;
  tutorId: string;
  tutorName: string;
  tutorInitials: string;
  tutorBio: string;
  photoUrl?: string;
  /** Tutor's own self-reported confidence. */
  selfConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Coordinator's graded confidence. */
  coordConfidence: 'HIGH' | 'MEDIUM' | 'UNPROVEN' | 'LOW';
  qualificationNote: string;
  gradedBy: string | null;
}

/** A pending subject change request from a tutor, enriched with display data. */
export interface PendingChange {
  changeId: string;
  tutorId: string;
  tutorName: string;
  tutorInitials: string;
  subjectId: string;
  subjectName: string;
  changeType: SubjectChangeType;
  requestedConf: SubjectConf | null;
  requestedNote: string | null;
  /** Current confidence on the approved tutor_subjects row (for EDIT changes). */
  currentConf: SubjectConf | null;
  createdAt: string;
}

export default async function SubjectsPage() {
  if (DEV_BYPASS) {
    return (
      <CoordinatorSubjectsClient
        initialSubjects={[]}
        claimsBySubject={{}}
        pendingChanges={[]}
      />
    );
  }

  const supabase = await createClient();

  const [
    { data: subjectRows,   error: subjectsError  },
    { data: claimRows,     error: claimsError    },
    { data: changeRows,    error: changesError   },
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, category, level')
      .order('category')
      .order('name'),
    supabase
      .from('tutor_subjects')
      .select('id, tutor_confidence, coordinator_confidence, qualification_note, graded_by, subject_id, tutor_id, users!tutor_subjects_tutor_id_fkey(name, bio, photo_url)')
      .order('created_at'),
    supabase
      .from('tutor_subject_changes')
      .select('id, tutor_id, subject_id, tutor_subject_id, change_type, requested_confidence, requested_note, status, created_at, users!tutor_subject_changes_tutor_id_fkey(name)')
      .eq('status', 'PENDING')
      .order('created_at'),
  ]);

  if (subjectsError) throw subjectsError;
  if (claimsError)   throw claimsError;
  if (changesError)  throw changesError;

  // Build a map of subject id → display name for enriching change rows
  const subjectNameById: Record<string, string> = {};
  for (const s of subjectRows ?? []) {
    subjectNameById[s.id] = s.level ? `${s.level} ${s.name}` : s.name;
  }

  // Build a map of tutor_subject id → current tutor_confidence for enriching EDIT changes
  const currentConfById: Record<string, SubjectConf> = {};
  for (const r of claimRows ?? []) {
    currentConfById[r.id] = r.tutor_confidence as SubjectConf;
  }

  // Build map: subject_id → claims
  const claimsBySubject: Record<string, TutorClaim[]> = {};
  for (const row of claimRows ?? []) {
    const tutorInfo = row.users as { name: string; bio: string | null; photo_url: string | null } | null;
    const name = tutorInfo?.name ?? 'Unknown';
    const claim: TutorClaim = {
      rowId:             row.id,
      tutorId:           row.tutor_id,
      tutorName:         name,
      tutorInitials:     initials(name),
      tutorBio:          tutorInfo?.bio ?? '',
      photoUrl:          tutorInfo?.photo_url ?? undefined,
      selfConfidence:    (row.tutor_confidence as TutorClaim['selfConfidence']) ?? 'MEDIUM',
      coordConfidence:   row.coordinator_confidence as TutorClaim['coordConfidence'],
      qualificationNote: row.qualification_note ?? '',
      gradedBy:          row.graded_by ?? null,
    };
    (claimsBySubject[row.subject_id] ??= []).push(claim);
  }

  // Build pending changes list
  const pendingChanges: PendingChange[] = (changeRows ?? []).map(row => {
    const tutorInfo = row.users as { name: string } | null;
    const tutorName = tutorInfo?.name ?? 'Unknown';
    return {
      changeId:     row.id,
      tutorId:      row.tutor_id,
      tutorName,
      tutorInitials: initials(tutorName),
      subjectId:    row.subject_id,
      subjectName:  subjectNameById[row.subject_id] ?? 'Unknown subject',
      changeType:   row.change_type as SubjectChangeType,
      requestedConf: row.requested_confidence as SubjectConf | null,
      requestedNote: row.requested_note ?? null,
      currentConf:  row.tutor_subject_id ? (currentConfById[row.tutor_subject_id] ?? null) : null,
      createdAt:    row.created_at,
    };
  });

  const subjects: SubjectRow[] = (subjectRows ?? []).map(s => ({
    id:         s.id,
    name:       s.name,
    category:   s.category,
    level:      s.level ?? '',
    tutorCount: claimsBySubject[s.id]?.length ?? 0,
  }));

  return (
    <CoordinatorSubjectsClient
      initialSubjects={subjects}
      claimsBySubject={claimsBySubject}
      pendingChanges={pendingChanges}
    />
  );
}
