/**
 * Business Days Helper
 *
 * Calculates business days (Mon–Fri) between two dates,
 * matching the backend convention in assessment-sla-check/route.ts.
 *
 * CONVENTION: Counts Mon–Fri days (dayOfWeek 1–5) between start (inclusive) and end (exclusive).
 * Used for SLA badge in assessor portal to match 10-business-day threshold.
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
  let current = new Date(start);
  let count = 0;

  while (current < end) {
    const dayOfWeek = current.getDay();
    // Only count Mon-Fri (1-5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
