import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// KUN Egypt coaching — CIB
const INSTAPAY_CONFIG = {
  account_name: 'KUN Egypt coaching',
  iban: 'EG76001002260000100056685922',
  bank: 'CIB',
};

/**
 * Generate a unique piaster suffix (01-99) not already pending
 * for the same base amount on the same day.
 */
async function generateUniqueAmount(baseAmount: number): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('payments')
    .select('amount')
    .eq('gateway', 'instapay' as any)
    .eq('status', 'pending')
    .gte('created_at', today + 'T00:00:00Z')
    .lte('created_at', today + 'T23:59:59Z');

  const usedSuffixes = new Set(
    (existing || []).map((p) => p.amount % 100)
  );

  let suffix: number;
  let attempts = 0;
  do {
    suffix = Math.floor(Math.random() * 99) + 1;
    attempts++;
  } while (usedSuffixes.has(suffix) && attempts < 200);

  // baseAmount is in minor units (piasters). suffix is piasters.
  return baseAmount + suffix;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_type, item_id, item_name, user_id, user_email, amount_egp, locale } = body;

    if (!item_type || !item_id || !user_id || !amount_egp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const uniqueAmount = await generateUniqueAmount(amount_egp);

    const { data: payment, error } = await supabase.from('payments').insert({
      amount: uniqueAmount,
      currency: 'EGP',
      gateway: 'instapay' as any,
      status: 'pending',
      metadata: {
        item_type,
        item_id,
        item_name,
        user_id,
        user_email,
        base_amount: amount_egp,
        unique_suffix: uniqueAmount % 100,
        instapay_account: INSTAPAY_CONFIG.account_name,
        instapay_iban: INSTAPAY_CONFIG.iban,
        verification_status: 'awaiting_transfer',
      },
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const displayAmount = (uniqueAmount / 100).toFixed(2);

    return NextResponse.json({
      payment_id: payment.id,
      instructions: {
        account_name: INSTAPAY_CONFIG.account_name,
        iban: INSTAPAY_CONFIG.iban,
        bank: INSTAPAY_CONFIG.bank,
        amount: displayAmount,
        amount_raw: uniqueAmount,
        currency: 'EGP',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[instapay-checkout]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
