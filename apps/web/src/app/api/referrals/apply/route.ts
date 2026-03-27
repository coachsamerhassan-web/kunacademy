import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
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
    const { data: txns } = await supabase
      .from('credit_transactions')
      .select('amount, type')
      .eq('user_id', user.id);

    let currentBalance = 0;
    if (txns) {
      for (const t of txns) {
        if (t.type === 'earn') currentBalance += t.amount;
        if (t.type === 'spend' || t.type === 'payout') currentBalance -= t.amount;
      }
    }

    if (amount > currentBalance) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    const balanceAfter = currentBalance - amount;

    // Create spend transaction
    const { error: txnError } = await supabase.from('credit_transactions').insert({
      user_id: user.id,
      amount,
      type: 'spend',
      source_type: 'checkout',
      source_id: payment_id,
      balance_after: balanceAfter,
      note: `Credits applied to payment ${payment_id}`,
    });

    if (txnError) {
      return NextResponse.json({ error: txnError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, applied: amount, balance: balanceAfter });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
