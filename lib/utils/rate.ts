/** Valid hourly rate values ($20–$40 in $5 increments). */
export const RATE_OPTIONS = [20, 25, 30, 35, 40] as const;
export type RateOption = (typeof RATE_OPTIONS)[number];

/** Returns true if v is a valid rate: integer, $20–$40, in $5 increments. */
export function isValidRate(v: unknown): v is RateOption {
  if (typeof v !== 'number' || !Number.isInteger(v)) return false;
  return (RATE_OPTIONS as readonly number[]).includes(v);
}
