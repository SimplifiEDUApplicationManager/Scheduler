/**
 * Date string utilities — server-safe, no timezone dependencies.
 */

/**
 * Converts a date string to YYYY-MM-DD for Postgres, or null if unparseable/ASAP/etc.
 * Requires a 4-digit year to be present before attempting flexible parsing — V8's
 * new Date() accepts strings like "May 6" and silently maps them to year 2001.
 */
export function toIsoDate(s?: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (!/\b\d{4}\b/.test(s)) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
