// Weekly hours calculation from Nylas events tagged as tutoring sessions.
// Unit-tested per spec — see __tests__/capacity.test.ts.
export type CapacityStatus = 'ok' | 'near' | 'at';

export function capacityStatus(current: number, max: number): CapacityStatus {
  if (current >= max) return 'at';
  if (current / max >= 0.8) return 'near';
  return 'ok';
}
