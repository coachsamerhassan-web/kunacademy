/**
 * GET /api/credit-balance
 * Returns the authenticated user's current store credit balance, grouped by currency.
 *
 * Source of truth: credit_transactions table (type='earn' adds, type='spend'/'payout' deducts).
 * referral_credit rows (source_type='referral_credit') are included automatically since
 * they use type='earn'.
 *
 * Response shape:
 *   { balances: { aed: 1500, usd: 200 } }
 *   { balances: {} }  — when the user has no transactions
 *
 * Multi-currency support added in Wave S0 #13 (13-C fix). Rows without an explicit
 * currency value default to 'aed' (schema default for pre-migration rows).
 *
 * This is a convenience endpoint for S2/S9 member profile and coach portal integration.
 * The checkout flow currently uses /api/referrals which returns the same balance data.
 */

import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { credit_transactions } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const txns = await db
      .select({
        amount: credit_transactions.amount,
        type: credit_transactions.type,
        currency: credit_transactions.currency,
      })
      .from(credit_transactions)
      .where(eq(credit_transactions.user_id, user.id));

    // Accumulate per-currency balances
    const balancesByCurrency: Record<string, number> = {};
    for (const t of txns) {
      const cur = (t.currency ?? 'aed').toLowerCase();
      const current = balancesByCurrency[cur] ?? 0;
      if (t.type === 'earn') balancesByCurrency[cur] = current + t.amount;
      if (t.type === 'spend' || t.type === 'payout') balancesByCurrency[cur] = current - t.amount;
    }

    // Clamp negatives to zero (defensive — should not occur, but guards against data anomalies)
    const balances: Record<string, number> = {};
    for (const [cur, amt] of Object.entries(balancesByCurrency)) {
      balances[cur] = Math.max(0, amt);
    }

    return NextResponse.json({ balances });
  } catch (err: any) {
    console.error('[api/credit-balance]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
