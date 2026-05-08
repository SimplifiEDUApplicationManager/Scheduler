import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SubjectReviewClient, type PendingReview } from '@/components/features/coordinator/SubjectReviewClient';
import { DEV_BYPASS } from '@/lib/env';
import { TUTORS, SUBJECTS } from '@/lib/data/mock';

export default async function SubjectsPage() {
  if (DEV_BYPASS) {
    // All mock tutor subjects are treated as UNPROVEN (no coordConf in mock data).
    // Show a representative subset so the page isn't overwhelming in dev.
    const pending: PendingReview[] = TUTORS.flatMap(tutor =>
      tutor.subjects
        .filter(ts => !ts.coordConf || ts.coordConf === 'UNPROVEN')
        .map(ts => {
          const subject = SUBJECTS.find(s => s.id === ts.id);
          const nameParts = tutor.name.split(' ');
          const initials  = nameParts.map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase();
          return {
            rowId:            `dev-${tutor.id}-${ts.id}`,
            tutorId:          tutor.id,
            tutorName:        tutor.name,
            tutorInitials:    initials,
            subjectName:      subject?.name ?? ts.id,
            subjectCat:       subject?.cat  ?? '',
            tutorConf:        ts.conf,
            qualificationNote: ts.qualificationNote ?? '',
          };
        })
    );
    return <SubjectReviewClient pending={pending} />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify coordinator/admin role
  const { data: row } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!row || !['COORDINATOR', 'SUPER_ADMIN'].includes(row.role)) {
    redirect('/login');
  }

  // Fetch all tutor_subjects where coordinator_confidence = UNPROVEN,
  // joined with subject and tutor names.
  const { data: rows } = await supabase
    .from('tutor_subjects')
    .select(`
      id,
      tutor_confidence,
      qualification_note,
      users!tutor_subjects_tutor_id_fkey ( id, name ),
      subjects!tutor_subjects_subject_id_fkey ( id, name, category )
    `)
    .eq('coordinator_confidence', 'UNPROVEN')
    .order('created_at', { ascending: false });

  const pending: PendingReview[] = (rows ?? []).map(r => {
    const tutor   = r.users as { id: string; name: string } | null;
    const subject = r.subjects as { id: string; name: string; category: string } | null;
    const nameParts = (tutor?.name ?? '').split(' ');
    const initials  = nameParts.map((p: string) => p[0] ?? '').join('').slice(0, 2).toUpperCase();
    return {
      rowId:             r.id,
      tutorId:           tutor?.id ?? '',
      tutorName:         tutor?.name ?? 'Unknown tutor',
      tutorInitials:     initials,
      subjectName:       subject?.name ?? 'Unknown subject',
      subjectCat:        subject?.category ?? '',
      tutorConf:         r.tutor_confidence as PendingReview['tutorConf'],
      qualificationNote: r.qualification_note ?? '',
    };
  });

  return <SubjectReviewClient pending={pending} />;
}
