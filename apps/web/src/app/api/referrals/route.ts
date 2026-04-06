import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { referral_codes, credit_transactions } from '@kunacademy/db/schema';
import { eq, and } from 'drizzle-orm';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let code = 'KUN-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get referral code
  const [codeRow] = await db
    .select({
      id: referral_codes.id,
      code: referral_codes.code,
      is_active: referral_codes.is_active,
      created_at: referral_codes.created_at,
    })
    .from(referral_codes)
    .where(eq(referral_codes.user_id, user.id))
    .limit(1);

  // Get all credit transactions for this user
  const transactions = await db
    .select({
      amount: credit_transactions.amount,
      type: credit_transactions.type,
    })
    .from(credit_transactions)
    .where(eq(credit_transactions.user_id, user.id));

  let totalEarned = 0;
  let totalSpent = 0;
  for (const t of transactions) {
    if (t.type === 'earn') totalEarned += t.amount;
    if (t.type === 'spend' || t.type === 'payout') totalSpent += t.amount;
  }

  // Count referrals (earn transactions from referrals)
  const referralTransactions = transactions.filter(
    (t) => t.type === 'earn'
  );
  // Re-query with source_type filter for accurate referral count
  const referralCount = await db
    .select({ id: credit_transactions.id })
    .from(credit_transactions)
    .where(
      and(
        eq(credit_transactions.user_id, user.id),
        eq(credit_transactions.type, 'earn'),
        eq(credit_transactions.source_type, 'referral')
      )
    );

  return NextResponse.json({
    code: codeRow?.code || null,
    is_active: codeRow?.is_active ?? false,
    total_referrals: referralCount.length,
    total_earned: totalEarned,
    balance: totalEarned - totalSpent,
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if user already has a code
  const [existing] = await db
    .select({ code: referral_codes.code })
    .from(referral_codes)
    .where(eq(referral_codes.user_id, user.id))
    .limit(1);

  if (existing) {
    return NextResponse.json({ code: existing.code });
  }

  // Generate unique code with retry
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await db.insert(referral_codes).values({
        user_id: user.id,
        code,
        is_active: true,
      });
      return NextResponse.json({ code });
    } catch (err: any) {
      // If unique constraint violation, retry
      if (
        !err.message?.includes('unique') &&
        !err.message?.includes('duplicate') &&
        !err.message?.includes('23505')
      ) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
}
