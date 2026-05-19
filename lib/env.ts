// Runtime environment flags.
// Import from here instead of checking process.env directly so there's one
// place to rename or change the evaluation logic.

/**
 * True only in local development with the bypass flag explicitly set.
 * Gated on NODE_ENV so it can never activate in production even if the
 * env var is accidentally set on Vercel.
 */
export const DEV_BYPASS =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true';
