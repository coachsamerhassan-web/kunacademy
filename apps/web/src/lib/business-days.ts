/**
 * Business Days Helper
 *
 * Calculates business days (Mon–Fri) between two dates,
 * matching the backend convention in assessment-sla-check/route.ts.
 *
 * CONVENTION: Counts Mon–Fri days (dayOfWeek 1–5) between start (inclusive) and end (exclusive).
 * Used for SLA badge in assessor portal to match 10-business-day threshold.
 *
 * NOTE: Uses UTC-based date methods throughout (getUTCDay, getUTCFullYear, getUTCMonth,
 * getUTCDate) to avoid locale-dependent day flips when the assessor's timezone differs
 * from UTC. submitted_at is stored as a UTC ISO string; comparing against local midnight
 * would miscount business days near midnight in UTC+offset timezones (e.g. Dubai UTC+4).
 */

/**
 * Calculate business days (Mon–Fri only) between two dates.
 *
 * @param start - Start date (inclusive)
 * @param end - End date (exclusive)
 * @returns Number of business days elapsed
 *
 * Matches backend convention in apps/web/src/app/api/cron/assessment-sla-check/route.ts
 */
export function businessDaysBetween(start: Date, end: Date): number {
  // Normalise to UTC midnight to avoid partial-day counting and TZ-dependent getDay() results
  let current = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endMs  = Date.UTC(end.getUTCFullYear(),   end.getUTCMonth(),   end.getUTCDate());
  let count = 0;

  while (current < endMs) {
    const dayOfWeek = new Date(current).getUTCDay();
    // Only count Mon-Fri (1-5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++;
    }
    current += 86_400_000; // advance by exactly one day in ms
  }

  return count;
}
