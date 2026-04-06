import { NextResponse } from 'next/server';
import { withUserContext } from '@kunacademy/db';
import { orders } from '@kunacademy/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

/** GET /api/user/orders — authenticated user's orders */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await withUserContext(user.id, async (db) => {
      return db.select()
        .from(orders)
        .where(eq(orders.customer_id, user.id))
        .orderBy(desc(orders.created_at));
    });

    return NextResponse.json({ orders: data });
  } catch (err: any) {
    console.error('[api/user/orders]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
