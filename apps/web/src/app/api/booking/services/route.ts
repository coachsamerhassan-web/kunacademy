import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { eq } from 'drizzle-orm';
import { services } from '@kunacademy/db/schema';

/** GET /api/booking/services — all active services (public) */
export async function GET() {
  try {
    const rows = await db
      .select({
        id: services.id,
        name_ar: services.name_ar,
        name_en: services.name_en,
        duration_minutes: services.duration_minutes,
        price_aed: services.price_aed,
        price_egp: services.price_egp,
        price_usd: services.price_usd,
        category_id: services.category_id,
        is_active: services.is_active,
      })
      .from(services)
      .where(eq(services.is_active, true));

    return NextResponse.json({ services: rows });
  } catch (err: any) {
    console.error('[api/booking/services]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
