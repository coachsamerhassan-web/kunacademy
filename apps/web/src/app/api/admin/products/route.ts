import { NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { products } from '@kunacademy/db/schema';
import { desc } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

/** GET /api/admin/products — admin-only: list all products */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await withAdminContext(async (db) => {
      return db.select()
        .from(products)
        .orderBy(desc(products.id))
        .limit(200);
    });

    return NextResponse.json({ products: data });
  } catch (err: any) {
    console.error('[api/admin/products]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
