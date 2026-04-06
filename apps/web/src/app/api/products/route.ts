import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { products } from '@kunacademy/db/schema';
import { eq, desc } from 'drizzle-orm';

/** GET /api/products — public product listing (active products only) */
export async function GET() {
  try {
    const data = await db.select()
      .from(products)
      .where(eq(products.is_active, true))
      .orderBy(desc(products.id));

    return NextResponse.json({ products: data });
  } catch (err: any) {
    console.error('[api/products]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
