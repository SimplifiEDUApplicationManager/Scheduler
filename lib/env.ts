// Runtime environment flags.
// Import from here instead of checking process.env directly so there's one
// place to rename or change the evaluation logic.

/** True when running in local dev with auth and Supabase bypassed. */
export const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true';
