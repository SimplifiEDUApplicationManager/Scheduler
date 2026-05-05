import { createClient } from '@/lib/supabase/server';
import { CoordinatorSubjectsClient } from '@/components/features/subjects/CoordinatorSubjectsClient';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export default async function SubjectsPage() {
  const supabase = await createClient();

  const [
    { data: subjectRows, error: subjectsError },
    { data: reviewRows,  error: reviewsError  },
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, category')
      .order('category')
      .order('name'),
    supabase
      .from('tutor_subjects')
      .select('id, qualification_note, confidence, subject_id, tutor_id, subjects(name, category), users!tutor_subjects_tutor_id_fkey(name)')
      .order('created_at'),
  ]);

  if (subjectsError) throw subjectsError;
  if (reviewsError)  throw reviewsError;

  const subjects = (subjectRows ?? []).map(s => ({
    id:       s.id,
    name:     s.name,
    category: s.category,
  }));

  const pendingReviews = (reviewRows ?? [])
    .filter(r => r.confidence === 'UNPROVEN')
    .map(r => {
      const tutorName = (r.users as { name: string } | null)?.name ?? 'Unknown';
      const subj      = r.subjects as { name: string; category: string } | null;
      return {
        rowId:             r.id,
        tutorId:           r.tutor_id,
        tutorName,
        tutorInitials:     initials(tutorName),
        subjectId:         r.subject_id,
        subjectName:       subj?.name ?? '',
        subjectCategory:   subj?.category ?? '',
        qualificationNote: r.qualification_note ?? '',
        confidence:        r.confidence as 'UNPROVEN',
      };
    });

  return (
    <CoordinatorSubjectsClient
      initialSubjects={subjects}
      initialPendingReviews={pendingReviews}
    />
  );
}
