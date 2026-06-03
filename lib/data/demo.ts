import type { TutorProposal } from '@/lib/types/domain';

/**
 * Practice proposal injected into new tutors' inbox during the Danielle
 * onboarding tour. Served server-side when the sim_tour_done cookie is absent.
 */
export const DEMO_PROPOSAL: TutorProposal = {
  id: 'demo-proposal',
  studentName: 'Alex Chen',
  studentEmail: 'alex.chen@example.com',
  subject: 'Algebra II',
  tuples: [{ day: 2, start: 16, end: 18 }],
  startDate: 'Next week',
  hoursPerWeek: 2,
  notes: 'Practice proposal — this is a demo so you can try the accept flow. Alex is a 10th grader looking for help with quadratic functions and systems of equations before midterms.',
  coordinator: 'Simplifi EDU',
  coordinatorEmail: 'demo@simplifiedu.com',
  sentAt: 'Just now',
  status: 'pending',
  tz: 'America/New_York',
  rationale: 'We chose you for this match because your Algebra II confidence is high and Tuesday afternoons are open on your calendar.',
  studentGrade: '10th grade',
  offeredRate: 30,
  parentName: 'Wei Chen',
  scheduleNotes: 'Tuesday 4–6 pm works best. Family is flexible by ±30 min.',
};
