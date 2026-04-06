import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { referral_codes, credit_transactions } from '@kunacademy/db/schema';
import { eq, and } from 'drizzle-orm';
import { getBusinessConfig } from '@/lib/cms-config';

export async function POST(request: NextRequest) {
  try {
    const { referral_code, new_user_id } = await request.json();

    if (!referral_code || !new_user_id) {
      return NextResponse.json({ error: 'Missing referral_code or new_user_id' }, { status: 400 });
    }

    // Validate code exists and is active
    const [codeRow] = await db
      .select({
        id: referral_codes.id,
        user_id: referral_codes.user_id,
        is_active: referral_codes.is_active,
      })
      .from(referral_codes)
      .where(eq(referral_codes.code, referral_code))
      .limit(1);

    if (!codeRow) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    if (!codeRow.is_active) {
      return NextResponse.json({ error: 'Referral code is no longer active' }, { status: 400 });
    }

    // Prevent self-referral
    if (codeRow.user_id === new_user_id) {
      return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 });
    }

    // Check if this new_user has already been tracked for this referrer (prevent double-credit)
    const [existingTxn] = await db
      .select({ id: credit_transactions.id })
      .from(credit_transactions)
      .where(
        and(
          eq(credit_transactions.user_id, codeRow.user_id),
          eq(credit_transactions.source_type, 'referral'),
          eq(credit_transactions.source_id, new_user_id)
        )
      )
      .limit(1);

    if (existingTxn) {
      return NextResponse.json({ error: 'Referral already tracked' }, { status: 409 });
    }

    // Get reward amount from CMS config
    const config = await getBusinessConfig();
    const REFERRAL_CREDIT_AMOUNT = config.referral_reward_amount;

    // Calculate balance_after from previous transactions
    const prevTxns = await db
      .select({
        amount: credit_transactions.amount,
        type: credit_transactions.type,
      })
      .from(credit_transactions)
      .where(eq(credit_transactions.user_id, codeRow.user_id));

    let currentBalance = 0;
    for (const t of prevTxns) {
      if (t.type === 'earn') currentBalance += t.amount;
      if (t.type === 'spend' || t.type === 'payout') currentBalance -= t.amount;
    }

    const balanceAfter = currentBalance + REFERRAL_CREDIT_AMOUNT;

    // Create earn transaction using admin context (bypasses RLS)
    await withAdminContext(async (adminDb) => {
      await adminDb.insert(credit_transactions).values({
        user_id: codeRow.user_id,
        amount: REFERRAL_CREDIT_AMOUNT,
        type: 'earn',
        source_type: 'referral',
        source_id: new_user_id,
        balance_after: balanceAfter,
        note: 'Referral credit for new user signup',
      });
    });

    return NextResponse.json({ success: true, credited: REFERRAL_CREDIT_AMOUNT, balance_after: balanceAfter });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
