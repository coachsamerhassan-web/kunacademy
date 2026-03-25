// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

import { getBusinessConfig } from '@/lib/cms-config';

export async function POST(request: NextRequest) {
  try {
    const { referral_code, new_user_id } = await request.json();

    if (!referral_code || !new_user_id) {
      return NextResponse.json({ error: 'Missing referral_code or new_user_id' }, { status: 400 });
    }

    // Validate code exists and is active
    const { data: codeRow } = await supabase
      .from('referral_codes')
      .select('id, user_id, is_active')
      .eq('code', referral_code)
      .single();

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
    const { data: existingTxn } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', codeRow.user_id)
      .eq('source_type', 'referral')
      .eq('source_id', new_user_id)
      .single();

    if (existingTxn) {
      return NextResponse.json({ error: 'Referral already tracked' }, { status: 409 });
    }

    // Get reward amount from CMS config
    const config = await getBusinessConfig();
    const REFERRAL_CREDIT_AMOUNT = config.referral_reward_amount;

    // Calculate balance_after from previous transactions
    const { data: prevTxns } = await supabase
      .from('credit_transactions')
      .select('amount, type')
      .eq('user_id', codeRow.user_id);

    let currentBalance = 0;
    if (prevTxns) {
      for (const t of prevTxns) {
        if (t.type === 'earn') currentBalance += t.amount;
        if (t.type === 'spend' || t.type === 'payout') currentBalance -= t.amount;
      }
    }

    const balanceAfter = currentBalance + REFERRAL_CREDIT_AMOUNT;

    // Create earn transaction
    const { error: txnError } = await supabase.from('credit_transactions').insert({
      user_id: codeRow.user_id,
      amount: REFERRAL_CREDIT_AMOUNT,
      type: 'earn',
      source_type: 'referral',
      source_id: new_user_id,
      balance_after: balanceAfter,
      note: `Referral credit for new user signup`,
    });

    if (txnError) {
      return NextResponse.json({ error: txnError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, credited: REFERRAL_CREDIT_AMOUNT, balance_after: balanceAfter });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
