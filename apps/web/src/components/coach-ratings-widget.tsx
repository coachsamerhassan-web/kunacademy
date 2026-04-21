/**
 * CoachRatingsWidget — Public aggregate rating display on coach profile pages.
 *
 * Server component. Bridges the Phase 2b instructor ↔ profile FK:
 *   instructors.slug → instructors.profile_id → coach_ratings.coach_id (= profiles.id)
 *
 * PRIVACY:
 *   - avg_stars + count_total computed over ALL ratings (numeric accuracy)
 *   - count_public is filtered by is_published=true (public flag)
 *   - No text, no names, no identifiable data — aggregates only
 *   - Matches the live coach_ratings schema (privacy text column is declared in
 *     Drizzle but not migrated; is_published is the enforced public gate)
 *
 * Widget shows "No ratings yet" when no public ratings exist.
 * Bilingual: AR "التقييمات" / EN "Ratings". Honors RTL via parent <html dir>.
 *
 * D4 — 2026-04-21
 */

import { db, withAdminContext, eq, and } from '@kunacademy/db';
import { coach_ratings, instructors } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

interface Props {
  /** instructors.slug — public slug from /coaches/[slug] */
  slug: string;
  locale: string;
}

interface Summary {
  avg_stars: number | null;
  count_total: number;
  count_public: number;
}

async function fetchSummaryBySlug(slug: string): Promise<Summary | null> {
  try {
    // Step 1 — resolve slug → profile_id via instructors bridge (Phase 2b FK)
    const instRows = await db
      .select({ profile_id: instructors.profile_id })
      .from(instructors)
      .where(and(eq(instructors.slug, slug), eq(instructors.published, true)))
      .limit(1);

    const profileId = instRows[0]?.profile_id;
    if (!profileId) {
      // Instructor exists but has no linked profile → no ratings possible
      return null;
    }

    // Step 2 — aggregate ALL ratings for numeric accuracy
    const aggRows = await withAdminContext(async (adminDb) => {
      return adminDb
        .select({
          avg_stars: sql<string | null>`avg(${coach_ratings.rating})::numeric(3,2)`,
          count_total: sql<number>`count(*)::int`,
        })
        .from(coach_ratings)
        .where(eq(coach_ratings.coach_id, profileId));
    });

    // Step 3 — public-only count (is_published=true is the enforced gate)
    const pubRows = await withAdminContext(async (adminDb) => {
      return adminDb
        .select({ count_public: sql<number>`count(*)::int` })
        .from(coach_ratings)
        .where(
          and(
            eq(coach_ratings.coach_id, profileId),
            eq(coach_ratings.is_published, true),
          ),
        );
    });

    const agg = aggRows[0];
    const count_total = agg?.count_total ?? 0;
    return {
      avg_stars: count_total > 0 && agg?.avg_stars != null ? parseFloat(agg.avg_stars) : null,
      count_total,
      count_public: pubRows[0]?.count_public ?? 0,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[CoachRatingsWidget] fetchSummaryBySlug(${slug}) failed: ${msg}`);
    return null;
  }
}

/** Render an inline stars row (1-decimal avg) with gold/neutral fill. */
function Stars({ avg }: { avg: number }) {
  // Five icons, filled proportionally. Accessible via aria-label on parent.
  const full = Math.floor(avg);
  const partial = avg - full; // 0..1
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        let fillPct = 0;
        if (i < full) fillPct = 100;
        else if (i === full) fillPct = Math.round(partial * 100);
        return (
          <div key={i} className="relative w-5 h-5">
            {/* Neutral base */}
            <svg viewBox="0 0 24 24" className="absolute inset-0 w-5 h-5 text-white/20 fill-current">
              <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18 22l-6-3.5L6 22l1.5-7.2L2 10l7.1-1.1z" />
            </svg>
            {/* Gold overlay clipped by fillPct */}
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-400 fill-current">
                <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18 22l-6-3.5L6 22l1.5-7.2L2 10l7.1-1.1z" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function CoachRatingsWidget({ slug, locale }: Props) {
  const summary = await fetchSummaryBySlug(slug);
  const isAr = locale === 'ar';
  const label = isAr ? 'التقييمات' : 'Ratings';

  // No linked profile OR no ratings at all → show "No ratings yet"
  if (!summary || summary.count_public === 0 || summary.avg_stars == null) {
    return (
      <div
        data-testid="coach-ratings-widget"
        data-ratings-state="empty"
        className="mt-5 inline-flex items-center gap-2 text-sm text-white/55"
      >
        <span className="font-medium">{label}:</span>
        <span>{isAr ? 'لا توجد تقييمات بعد' : 'No ratings yet'}</span>
      </div>
    );
  }

  const avgDisplay = summary.avg_stars.toFixed(1);
  const countLabel = isAr
    ? `${summary.count_public} تقييم${summary.count_public === 1 ? '' : 'ًا'}`
    : `${summary.count_public} review${summary.count_public === 1 ? '' : 's'}`;

  return (
    <div
      data-testid="coach-ratings-widget"
      data-ratings-state="populated"
      data-avg={avgDisplay}
      data-count={summary.count_public}
      className="mt-5 inline-flex items-center gap-3 text-sm text-white/80"
      aria-label={isAr
        ? `التقييمات: ${avgDisplay} من 5، ${countLabel}`
        : `Ratings: ${avgDisplay} out of 5, based on ${countLabel}`}
    >
      <span className="font-medium text-white/70">{label}:</span>
      <Stars avg={summary.avg_stars} />
      <span className="font-semibold text-white">{avgDisplay}</span>
      <span className="text-white/55">({countLabel})</span>
    </div>
  );
}
