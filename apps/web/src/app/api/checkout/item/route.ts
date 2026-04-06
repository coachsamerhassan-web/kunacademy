import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@kunacademy/db';
import { courses, bookings, services } from '@kunacademy/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/checkout/item?type=course&id=...
 * GET /api/checkout/item?type=course&slug=...
 * GET /api/checkout/item?type=booking&id=...
 *
 * Returns item data needed for checkout price display.
 * Public endpoint — no auth required (prices are not secret).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const slug = searchParams.get('slug');

    if (!type) {
      return NextResponse.json({ error: 'Missing type' }, { status: 400 });
    }

    if (type === 'course') {
      if (slug) {
        const [data] = await db.select({
          id: courses.id,
          title_ar: courses.title_ar,
          title_en: courses.title_en,
          price_aed: courses.price_aed,
          price_sar: courses.price_sar,
          price_egp: courses.price_egp,
          price_usd: courses.price_usd,
          price_eur: courses.price_eur,
        })
          .from(courses)
          .where(and(eq(courses.slug, slug), eq(courses.is_published, true)))
          .limit(1);

        if (!data) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        return NextResponse.json({
          type: 'course',
          id: data.id,
          name_ar: data.title_ar,
          name_en: data.title_en,
          price_aed: data.price_aed,
          price_sar: data.price_sar,
          price_egp: data.price_egp,
          price_usd: data.price_usd,
          price_eur: data.price_eur,
        });
      }

      if (id) {
        const [data] = await db.select({
          id: courses.id,
          title_ar: courses.title_ar,
          title_en: courses.title_en,
          price_aed: courses.price_aed,
          price_sar: courses.price_sar,
          price_egp: courses.price_egp,
          price_usd: courses.price_usd,
          price_eur: courses.price_eur,
        })
          .from(courses)
          .where(eq(courses.id, id))
          .limit(1);

        if (!data) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        return NextResponse.json({
          type: 'course',
          id: data.id,
          name_ar: data.title_ar,
          name_en: data.title_en,
          price_aed: data.price_aed,
          price_sar: data.price_sar,
          price_egp: data.price_egp,
          price_usd: data.price_usd,
          price_eur: data.price_eur,
        });
      }

      return NextResponse.json({ error: 'Missing id or slug' }, { status: 400 });
    }

    if (type === 'booking') {
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      const [booking] = await db.select({
        id: bookings.id,
        service_id: bookings.service_id,
      })
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1);

      if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

      if (booking.service_id) {
        const [svc] = await db.select({
          id: services.id,
          name_ar: services.name_ar,
          name_en: services.name_en,
          price_aed: services.price_aed,
          price_sar: services.price_sar,
          price_egp: services.price_egp,
          price_usd: services.price_usd,
        })
          .from(services)
          .where(eq(services.id, booking.service_id))
          .limit(1);

        if (svc) {
          return NextResponse.json({
            type: 'booking',
            id: booking.id,
            name_ar: svc.name_ar,
            name_en: svc.name_en,
            price_aed: svc.price_aed,
            price_sar: svc.price_sar,
            price_egp: svc.price_egp,
            price_usd: svc.price_usd,
            price_eur: 0,
          });
        }
      }

      return NextResponse.json({ error: 'Booking service not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Unknown item type' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/checkout/item]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
