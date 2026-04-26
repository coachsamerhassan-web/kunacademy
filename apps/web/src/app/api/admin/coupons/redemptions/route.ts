/**
 * /api/admin/coupons/redemptions — Wave F.5
 *
 * GET — list redemptions with optional filters (coupon_id, customer_id, date range).
 * Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const couponId = url.searchParams.get('coupon_id');
  const customerId = url.searchParams.get('customer_id');
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '200', 10), 1), 1000);

  if (couponId && !UUID_RE.test(couponId)) {
    return NextResponse.json({ error: 'Invalid coupon_id' }, { status: 400 });
  }
  if (customerId && !UUID_RE.test(customerId)) {
    return NextResponse.json({ error: 'Invalid customer_id' }, { status: 400 });
  }
  if (since && Number.isNaN(new Date(since).getTime())) {
    return NextResponse.json({ error: 'Invalid since' }, { status: 400 });
  }
  if (until && Number.isNaN(new Date(until).getTime())) {
    return NextResponse.json({ error: 'Invalid until' }, { status: 400 });
  }

  // Build WHERE clauses incrementally (parameterized)
  const wheres: ReturnType<typeof sql>[] = [];
  if (couponId) wheres.push(sql`r.coupon_id = ${couponId}::uuid`);
  if (customerId) wheres.push(sql`r.customer_id = ${customerId}::uuid`);
  if (since) wheres.push(sql`r.redeemed_at >= ${since}::timestamptz`);
  if (until) wheres.push(sql`r.redeemed_at <= ${until}::timestamptz`);

  let whereClause = wheres.length === 0
    ? sql`true`
    : wheres[0];
  for (let i = 1; i < wheres.length; i++) {
    whereClause = sql`${whereClause} AND ${wheres[i]}`;
  }

  const rows = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT
        r.id, r.coupon_id, r.customer_id, r.order_id,
        r.amount_applied, r.currency, r.redeemed_at,
        c.code AS coupon_code,
        c.type AS coupon_type,
        c.value AS coupon_value,
        p.email AS customer_email,
        p.full_name_en AS customer_name_en,
        p.full_name_ar AS customer_name_ar
      FROM coupon_redemptions r
      LEFT JOIN coupons c   ON c.id = r.coupon_id
      LEFT JOIN profiles p  ON p.id = r.customer_id
      WHERE ${whereClause}
      ORDER BY r.redeemed_at DESC
      LIMIT ${limit}
    `);
    return rows;
  });

  return NextResponse.json({ redemptions: rows, limit });
}
