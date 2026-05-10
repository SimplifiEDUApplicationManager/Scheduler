import { redirect } from 'next/navigation';

export default function TutorSubjectsPage() {
  redirect('/tutor/settings?section=subjects');
}
