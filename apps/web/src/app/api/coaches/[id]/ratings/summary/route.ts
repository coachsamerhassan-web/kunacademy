/**
 * GET /api/coaches/[id]/ratings/summary
 *
 * Public aggregate endpoint — no auth required.
 * Returns numeric summary for a coach's ratings.
 *
 * RULES:
 *   - avg_stars, count_total, distribution: over is_published=true rows only
 *     (RLS on the default role gates to published; privacy column was dropped
 *     2026-04-21 so "public = published" — numeric and display sets match).
 *   - count_public: explicit count of is_published=true rows (same set; kept
 *     for backward-compat with existing clients).
 *   - NO text content or identifiable data is returned
 *
 * Response:
 *   {
 *     avg_stars: number | null,
 *     count_total: number,
 *     count_public: number,
 *     distribution: { "1": n, "2": n, "3": n, "4": n, "5": n }
 *   }
 *
 * Wave S9 — 2026-04-20
 * 2026-04-21: privacy column dropped — is_published is the sole display gate.
 * 2026-04-21: migration 0034 adds coach_ratings_anon_public_read policy; public
 * reads now rely on RLS (coach_ratings_public_select + anon_public_read) rather
 * than admin-role escalation. Default `db` is safe here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and } from '@kunacademy/db';
import { coach_ratings, profiles } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: coachId } = await context.params;

    if (!UUID_RE.test(coachId)) {
      return NextResponse.json({ error: 'Invalid coach id — must be a UUID' }, { status: 400 });
    }

    // Verify coach exists — role must be 'coach' to prevent user enumeration
    const coachRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.id, coachId), eq(profiles.role, 'coach')))
      .limit(1);

    if (!coachRows[0]) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Aggregate over published ratings only.
    // RLS (coach_ratings_public_select) gates rows to is_published=true for
    // non-admin roles, so the default `db` role sees published rows only and
    // our numeric aggregates match what the public display shows.
    const aggRows = await db
      .select({
        avg_stars: sql<string | null>`avg(${coach_ratings.rating})::numeric(3,2)`,
        count_total: sql<number>`count(*)::int`,
        dist_1: sql<number>`count(*) filter (where ${coach_ratings.rating} = 1)::int`,
        dist_2: sql<number>`count(*) filter (where ${coach_ratings.rating} = 2)::int`,
        dist_3: sql<number>`count(*) filter (where ${coach_ratings.rating} = 3)::int`,
        dist_4: sql<number>`count(*) filter (where ${coach_ratings.rating} = 4)::int`,
        dist_5: sql<number>`count(*) filter (where ${coach_ratings.rating} = 5)::int`,
      })
      .from(coach_ratings)
      .where(eq(coach_ratings.coach_id, coachId));

    // Public-only count = published rows (explicit WHERE as defense-in-depth
    // alongside the RLS gate).
    const publicCountRows = await db
      .select({ count_public: sql<number>`count(*)::int` })
      .from(coach_ratings)
      .where(
        and(
          eq(coach_ratings.coach_id, coachId),
          eq(coach_ratings.is_published, true),
        ),
      );

    const agg = aggRows[0];
    const avg_stars = agg?.avg_stars != null ? parseFloat(agg.avg_stars) : null;
    const count_total = agg?.count_total ?? 0;
    const count_public = publicCountRows[0]?.count_public ?? 0;

    return NextResponse.json({
      avg_stars: count_total > 0 ? avg_stars : null,
      count_total,
      count_public,
      distribution: {
        '1': agg?.dist_1 ?? 0,
        '2': agg?.dist_2 ?? 0,
        '3': agg?.dist_3 ?? 0,
        '4': agg?.dist_4 ?? 0,
        '5': agg?.dist_5 ?? 0,
      },
    });
  } catch (err: any) {
    console.error('[api/coaches/[id]/ratings/summary GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
