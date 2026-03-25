// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let code = 'KUN-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get referral code
  const { data: codeRow } = await supabase
    .from('referral_codes')
    .select('id, code, is_active, created_at')
    .eq('user_id', user.id)
    .single();

  // Get credit stats
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('amount, type')
    .eq('user_id', user.id);

  let totalEarned = 0;
  let totalSpent = 0;
  if (transactions) {
    for (const t of transactions) {
      if (t.type === 'earn') totalEarned += t.amount;
      if (t.type === 'spend' || t.type === 'payout') totalSpent += t.amount;
    }
  }

  // Count referrals (earn transactions from referrals)
  const { count: totalReferrals } = await supabase
    .from('credit_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('type', 'earn')
    .eq('source_type', 'referral');

  return NextResponse.json({
    code: codeRow?.code || null,
    is_active: codeRow?.is_active ?? false,
    total_referrals: totalReferrals || 0,
    total_earned: totalEarned,
    balance: totalEarned - totalSpent,
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if user already has a code
  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json({ code: existing.code });
  }

  // Generate unique code with retry
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const { error } = await supabase.from('referral_codes').insert({
      user_id: user.id,
      code,
      is_active: true,
    });
    if (!error) {
      return NextResponse.json({ code });
    }
    // If unique constraint violation, retry
    if (!error.message.includes('unique') && !error.message.includes('duplicate')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
}
