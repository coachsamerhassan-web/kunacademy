import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { and, arrayContains, eq, isNull, or } from 'drizzle-orm';
import { services, instructors } from '@kunacademy/db/schema';

/**
 * GET /api/booking/services — active services for the booking flow (public)
 *
 * Query params:
 *   ?kun_level=basic|professional|expert|master
 *     → Return only services whose eligible_kun_levels includes the given level
 *       OR services with no level restriction (eligible_kun_levels IS NULL).
 *       Also computes price_aed for the 3-session-package based on the tier price.
 *
 *   ?coach_slug=<slug>
 *     → Resolve the coach's kun_level automatically from the instructors table,
 *       then apply the same filtering as above.
 *
 * Without any param → all active services (backward compat for generic booking page).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let kunLevel = searchParams.get('kun_level') ?? null;
  const coachSlug = searchParams.get('coach_slug') ?? null;

  // Resolve kun_level from coach_slug if provided
  if (!kunLevel && coachSlug) {
    const [inst] = await db
      .select({ kun_level: instructors.kun_level })
      .from(instructors)
      .where(eq(instructors.slug, coachSlug))
      .limit(1);
    kunLevel = inst?.kun_level ?? null;
  }

  try {
    let rows;

    if (kunLevel) {
      // Filter: services eligible for this level OR no level restriction
      rows = await db
        .select({
          id: services.id,
          slug: services.slug,
          name_ar: services.name_ar,
          name_en: services.name_en,
          duration_minutes: services.duration_minutes,
          price_aed: services.price_aed,
          price_egp: services.price_egp,
          price_usd: services.price_usd,
          category_id: services.category_id,
          sessions_count: services.sessions_count,
          eligible_kun_levels: services.eligible_kun_levels,
          is_active: services.is_active,
        })
        .from(services)
        .where(
          and(
            eq(services.is_active, true),
            or(
              arrayContains(services.eligible_kun_levels, [kunLevel]),
              isNull(services.eligible_kun_levels)
            )
          )
        );

      // For the 3-session-package: price_aed is 0 in DB (computed per tier).
      // Inject computed price: tier_price × 3 × 0.85 (15% discount), in minor units.
      const TIER_PRICE_MINOR: Record<string, number> = {
        basic:        25000,  // 250 AED × 100
        professional: 40000,  // 400 AED × 100
        expert:       60000,  // 600 AED × 100
        master:       80000,  // 800 AED × 100
      };
      const tierPrice = TIER_PRICE_MINOR[kunLevel] ?? 0;
      const packagePrice = Math.round(tierPrice * 3 * 0.85);

      rows = rows.map((svc) =>
        svc.slug === '3-session-package' && packagePrice > 0
          ? { ...svc, price_aed: packagePrice }
          : svc
      );
    } else {
      // No filter: return all active services
      rows = await db
        .select({
          id: services.id,
          slug: services.slug,
          name_ar: services.name_ar,
          name_en: services.name_en,
          duration_minutes: services.duration_minutes,
          price_aed: services.price_aed,
          price_egp: services.price_egp,
          price_usd: services.price_usd,
          category_id: services.category_id,
          sessions_count: services.sessions_count,
          eligible_kun_levels: services.eligible_kun_levels,
          is_active: services.is_active,
        })
        .from(services)
        .where(eq(services.is_active, true));
    }

    return NextResponse.json({ services: rows });
  } catch (err: any) {
    console.error('[api/booking/services]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
