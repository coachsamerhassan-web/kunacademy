// @ts-nocheck
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

async function getUserRole(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role ?? null;
}

/** Calculate available balance for a coach */
async function getAvailableBalance(userId: string): Promise<number> {
  // Sum of available earnings (amount is in minor units: 250 AED = 25000)
  const { data: availableEarnings } = await supabase
    .from('earnings')
    .select('net_amount')
    .eq('user_id', userId)
    .eq('status', 'available');

  const availableTotal = (availableEarnings ?? []).reduce(
    (sum: number, e: any) => sum + (e.net_amount ?? 0),
    0
  );

  // Subtract requested/approved payouts (use 'processed' instead of 'processing')
  const { data: activePayout } = await supabase
    .from('payout_requests')
    .select('amount')
    .eq('user_id', userId)
    .in('status', ['requested', 'approved']);

  const payoutTotal = (activePayout ?? []).reduce(
    (sum: number, p: any) => sum + (p.amount ?? 0),
    0
  );

  return availableTotal - payoutTotal;
}

/** GET /api/payouts — List payout requests */
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);

  if (role === 'admin') {
    // Admin sees all payouts with user names
    const { data, error } = await supabase
      .from('payout_requests')
      .select('*, profiles:user_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ payouts: data });
  }

  // User sees own payouts
  const { data, error } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const balance = await getAvailableBalance(user.id);
  return NextResponse.json({ payouts: data, available_balance: balance });
}

/** POST /api/payouts — Coach requests a payout */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { amount, currency = 'AED', bank_details } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  if (!bank_details?.bank_name || !bank_details?.iban || !bank_details?.account_name) {
    return NextResponse.json({ error: 'Bank details required (bank_name, iban, account_name)' }, { status: 400 });
  }

  // Validate balance
  const available = await getAvailableBalance(user.id);
  if (amount > available) {
    return NextResponse.json({
      error: 'Insufficient balance',
      available_balance: available,
      requested: amount,
    }, { status: 400 });
  }

  const { data: payout, error } = await supabase
    .from('payout_requests')
    .insert({
      user_id: user.id,
      amount,
      currency,
      status: 'requested',
      bank_details: bank_details || {},
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payout }, { status: 201 });
}

/** PATCH /api/payouts — Admin action on payout */
export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { payout_id, action, admin_note } = body;

  if (!payout_id || !action) {
    return NextResponse.json({ error: 'Missing payout_id or action' }, { status: 400 });
  }

  if (!['approve', 'reject', 'complete'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Get the payout
  const { data: payout } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('id', payout_id)
    .single();

  if (!payout) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
  }

  const statusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    complete: 'processed', // DB uses 'processed', not 'completed'
  };

  const updateData: Record<string, unknown> = {
    status: statusMap[action],
    admin_note: admin_note || payout.admin_note,
    processed_by: user.id, // Record who processed it
  };

  if (action === 'complete' || action === 'reject') {
    updateData.processed_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from('payout_requests')
    .update(updateData)
    .eq('id', payout_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // On complete: mark associated earnings as paid_out
  if (action === 'complete') {
    // Mark enough available earnings as paid_out to cover the payout amount
    const { data: availableEarnings } = await supabase
      .from('earnings')
      .select('id, net_amount')
      .eq('user_id', payout.user_id)
      .eq('status', 'available')
      .order('created_at', { ascending: true });

    let remaining = payout.amount;
    const earningIds: string[] = [];

    for (const e of (availableEarnings ?? [])) {
      if (remaining <= 0) break;
      earningIds.push(e.id);
      remaining -= e.net_amount;
    }

    if (earningIds.length > 0) {
      await supabase
        .from('earnings')
        .update({ status: 'paid_out' })
        .in('id', earningIds);
    }
  }

  return NextResponse.json({ payout: updated });
}
