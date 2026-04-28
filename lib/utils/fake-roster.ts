import type { Tutor, Subject } from '@/lib/data/dashboard-mock';

export interface FakeStudent {
  name: string;
  subject: string;
  hoursPerWeek: number;
  since: string;
  sessions: number;
  atRisk: boolean;
}

/** Generates a deterministic fake student roster seeded from tutor data. For mock/prototype use only. */
export function fakeRoster(tutor: Tutor, subjects: Subject[]): FakeStudent[] {
  const firstNames = ['Emma', 'Noah', 'Sophia', 'Ethan', 'Olivia', 'Lucas', 'Isabella', 'Mason', 'Ava', 'Logan'];
  const lastInitials = ['L.', 'R.', 'T.', 'B.', 'M.', 'K.', 'J.', 'P.'];
  const sinceLabels = ['2 weeks ago', 'last month', '3 months ago', '6 weeks ago'];
  const count = Math.min(tutor.subjects.length + 1, Math.floor(tutor.hoursCurrent / 2));
  const seed = tutor.id.length;
  return Array.from({ length: count }, (_, i) => {
    const subj = tutor.subjects[i % tutor.subjects.length];
    return {
      name: `${firstNames[(seed + i * 3) % firstNames.length]} ${lastInitials[(seed + i) % lastInitials.length]}`,
      subject: subjects.find(s => s.id === subj.id)?.name ?? 'Tutoring',
      hoursPerWeek: 2,
      since: sinceLabels[(seed + i) % sinceLabels.length],
      sessions: 4 + ((seed + i * 7) % 18),
      atRisk: i === 0 && seed % 5 === 0,
    };
  });
}
