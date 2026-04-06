import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { credit_transactions } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { amount, payment_id } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!payment_id) {
      return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    // Calculate current balance
    const txns = await db
      .select({
        amount: credit_transactions.amount,
        type: credit_transactions.type,
      })
      .from(credit_transactions)
      .where(eq(credit_transactions.user_id, user.id));

    let currentBalance = 0;
    for (const t of txns) {
      if (t.type === 'earn') currentBalance += t.amount;
      if (t.type === 'spend' || t.type === 'payout') currentBalance -= t.amount;
    }

    if (amount > currentBalance) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    const balanceAfter = currentBalance - amount;

    // Create spend transaction using admin context (bypasses RLS)
    await withAdminContext(async (adminDb) => {
      await adminDb.insert(credit_transactions).values({
        user_id: user.id,
        amount,
        type: 'spend',
        source_type: 'checkout',
        source_id: payment_id,
        balance_after: balanceAfter,
        note: `Credits applied to payment ${payment_id}`,
      });
    });

    return NextResponse.json({ success: true, applied: amount, balance: balanceAfter });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
