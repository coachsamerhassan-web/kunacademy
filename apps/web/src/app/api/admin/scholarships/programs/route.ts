/**
 * GET /api/admin/scholarships/programs — Wave E.5 + E.6
 *
 * Two modes:
 *
 *   1. List mode (default): no query params.
 *      Returns programs.scholarship_eligible=true rows for the admin
 *      manual-entry + allocation matcher dropdowns.
 *
 *   2. Single-program price-lookup mode (E.6): ?slug=<slug>&currency=<AED|EGP|USD|EUR>
 *      Returns { price_cents, currency, slug, family } for the allocation
 *      matcher's progress meter. Reads from the canon programs table; converts
 *      major→minor currency units (×100).
 *
 * Auth: admin | super_admin via getAuthUser().
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthUser } from '@kunacademy/auth/server';
import { listEligibleScholarshipPrograms } from '@/lib/scholarship-application';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

const VALID_CURRENCIES = new Set(['AED', 'EGP', 'USD', 'EUR']);
const CURRENCY_TO_PRICE_COL: Record<string, string> = {
  AED: 'price_aed',
  EGP: 'price_egp',
  USD: 'price_usd',
  EUR: 'price_eur',
};
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,127}$/;

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const currency = url.searchParams.get('currency');

  // Single-program price-lookup mode
  if (slug || currency) {
    if (!slug || !SLUG_RE.test(slug)) {
      return NextResponse.json({ error: 'invalid-slug' }, { status: 400 });
    }
    if (!currency || !VALID_CURRENCIES.has(currency.toUpperCase())) {
      return NextResponse.json({ error: 'invalid-currency' }, { status: 400 });
    }
    const upper = currency.toUpperCase();
    const priceCol = CURRENCY_TO_PRICE_COL[upper]!;

    try {
      const result = await withAdminContext(async (db) => {
        const r = await db.execute(sql`
          SELECT
            slug,
            nav_group           AS family,
            ${sql.raw(priceCol)} AS price_major,
            scholarship_eligible
          FROM programs
          WHERE slug = ${slug}
          LIMIT 1
        `);
        return r.rows[0] as
          | {
              slug: string;
              family: string;
              price_major: string | number | null;
              scholarship_eligible: boolean | null;
            }
          | undefined;
      });
      if (!result) {
        return NextResponse.json({ error: 'program-not-found' }, { status: 404 });
      }
      if (result.scholarship_eligible !== true) {
        return NextResponse.json(
          { error: 'program-not-scholarship-eligible' },
          { status: 422 },
        );
      }
      const priceMajor = result.price_major == null ? null : Number(result.price_major);
      if (priceMajor === null || !Number.isFinite(priceMajor) || priceMajor <= 0) {
        return NextResponse.json(
          { error: 'program-no-price', slug: result.slug, currency: upper },
          { status: 422 },
        );
      }
      return NextResponse.json({
        slug: result.slug,
        family: result.family,
        currency: upper,
        price_cents: Math.round(priceMajor * 100),
      });
    } catch (err) {
      console.error('[admin-scholarships-programs] price-lookup failed:', err);
      return NextResponse.json({ error: 'lookup-failed' }, { status: 500 });
    }
  }

  // List mode (default)
  try {
    const programs = await listEligibleScholarshipPrograms();
    return NextResponse.json({ programs });
  } catch (err) {
    console.error('[admin-scholarships-programs] lookup failed:', err);
    return NextResponse.json({ error: 'lookup-failed' }, { status: 500 });
  }
}
