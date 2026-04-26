/**
 * GET /api/admin/scholarships/donations-available — Wave E.6
 *
 * Lists donations eligible for allocation: status='received',
 * not yet allocated, optionally filtered by currency.
 *
 * Response shape:
 *   { donations: AvailableDonationRow[] }
 *
 * Auth: admin | super_admin via getAuthUser().
 *
 * Donor names are NEVER returned — anonymized as "Donor #N" per spec §9.3.
 *
 * Query params:
 *   currency (optional) — restrict to AED|EGP|USD|EUR. If omitted, returns
 *                          all currencies (admin sees the full pool).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthUser } from '@kunacademy/auth/server';
import { listAvailableDonationsForAllocation } from '@/lib/scholarship-allocation';

const VALID_CURRENCIES = new Set(['AED', 'EGP', 'USD', 'EUR']);

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const currencyRaw = url.searchParams.get('currency');
  let currency: string | undefined = undefined;
  if (currencyRaw) {
    const upper = currencyRaw.toUpperCase();
    if (!VALID_CURRENCIES.has(upper)) {
      return NextResponse.json({ error: 'invalid-currency' }, { status: 400 });
    }
    currency = upper;
  }

  try {
    const donations = await listAvailableDonationsForAllocation({ currency });
    return NextResponse.json({ donations });
  } catch (err) {
    console.error('[admin-scholarships-donations-available] failed:', err);
    return NextResponse.json({ error: 'read-failed' }, { status: 500 });
  }
}
