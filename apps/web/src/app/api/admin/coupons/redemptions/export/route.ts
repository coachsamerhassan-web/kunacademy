/**
 * /api/admin/coupons/redemptions/export — Wave F.5
 *
 * GET — CSV export of redemptions. Same filters as the list endpoint.
 * Admin-only.
 *
 * CSV escaping per RFC 4180: any field containing comma, double-quote, or
 * newline is wrapped in double-quotes; embedded double-quotes are doubled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // CSV-injection guard: prefix cells starting with =, +, -, @ with a single
  // apostrophe (Excel formula-injection mitigation) so the cell is treated
  // as text. Common practice for any user-provided text exported to CSV.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const couponId = url.searchParams.get('coupon_id');
  const customerId = url.searchParams.get('customer_id');
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');

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
        p.email AS customer_email
      FROM coupon_redemptions r
      LEFT JOIN coupons c   ON c.id = r.coupon_id
      LEFT JOIN profiles p  ON p.id = r.customer_id
      WHERE ${whereClause}
      ORDER BY r.redeemed_at DESC
      LIMIT 10000
    `);
    return rows;
  });

  // Header + body
  const header = [
    'redemption_id',
    'coupon_id',
    'coupon_code',
    'coupon_type',
    'coupon_value',
    'customer_id',
    'customer_email',
    'order_id',
    'amount_applied_minor',
    'currency',
    'redeemed_at',
  ];
  const lines: string[] = [header.join(',')];
  for (const r of rows as Array<Record<string, unknown>>) {
    lines.push(
      [
        r.id,
        r.coupon_id,
        r.coupon_code,
        r.coupon_type,
        r.coupon_value,
        r.customer_id,
        r.customer_email,
        r.order_id,
        r.amount_applied,
        r.currency,
        r.redeemed_at,
      ].map(csvEscape).join(','),
    );
  }
  // RFC 4180 prefers CRLF; \r\n widely supported.
  const csv = lines.join('\r\n') + '\r\n';

  // Build a stable filename
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="coupon-redemptions-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
