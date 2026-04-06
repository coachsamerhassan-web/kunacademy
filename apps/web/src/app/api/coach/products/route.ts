import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { services, service_categories, instructors } from '@kunacademy/db/schema';

/**
 * GET /api/coach/products
 * Returns all services + categories (scoped to authenticated coach session).
 * Any coach can view and manage services — they are the bookable offerings in the platform.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify user has a coach/instructor profile
    const instRows = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.profile_id, user.id))
      .limit(1);

    if (!instRows[0]) {
      return NextResponse.json({ error: 'No coach profile found' }, { status: 403 });
    }

    const [serviceRows, categoryRows] = await Promise.all([
      db
        .select({
          id: services.id,
          name_ar: services.name_ar,
          name_en: services.name_en,
          description_ar: services.description_ar,
          description_en: services.description_en,
          duration_minutes: services.duration_minutes,
          price_aed: services.price_aed,
          price_egp: services.price_egp,
          price_usd: services.price_usd,
          is_active: services.is_active,
          category_id: services.category_id,
          sessions_count: services.sessions_count,
          validity_days: services.validity_days,
          commission_override_pct: services.commission_override_pct,
        })
        .from(services)
        .orderBy(services.name_en),

      db
        .select({
          id: service_categories.id,
          name_ar: service_categories.name_ar,
          name_en: service_categories.name_en,
          slug: service_categories.slug,
        })
        .from(service_categories)
        .orderBy(service_categories.display_order),
    ]);

    return NextResponse.json({ services: serviceRows, categories: categoryRows });
  } catch (err: any) {
    console.error('[api/coach/products GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/coach/products
 * Create a new service.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify coach profile
    const instRows = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.profile_id, user.id))
      .limit(1);

    if (!instRows[0]) {
      return NextResponse.json({ error: 'No coach profile found' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name_ar,
      name_en,
      description_ar,
      description_en,
      duration_minutes,
      price_aed,
      price_egp,
      price_usd,
      category_id,
      sessions_count,
      validity_days,
      is_active,
    } = body;

    if (!name_ar || !name_en || !duration_minutes) {
      return NextResponse.json(
        { error: 'name_ar, name_en, and duration_minutes are required' },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(services)
      .values({
        name_ar: name_ar.trim(),
        name_en: name_en.trim(),
        description_ar: description_ar?.trim() || null,
        description_en: description_en?.trim() || null,
        duration_minutes: Number(duration_minutes),
        price_aed: price_aed ? Number(price_aed) : 0,
        price_egp: price_egp ? Number(price_egp) : 0,
        price_usd: price_usd ? Number(price_usd) : 0,
        category_id: category_id || null,
        sessions_count: sessions_count ? Number(sessions_count) : null,
        validity_days: validity_days ? Number(validity_days) : null,
        is_active: is_active !== false,
      })
      .returning();

    return NextResponse.json({ service: created }, { status: 201 });
  } catch (err: any) {
    console.error('[api/coach/products POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
