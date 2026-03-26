import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';
import type {
  PayoutRequest,
  PayoutRequestPayload,
  PayoutActionPayload,
  PayoutsResponse,
  PayoutResponse,
} from '@/types/commission-system';

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
  const profile = data as Record<string, unknown> | null;
  return (profile?.role as string | undefined) ?? null;
}

/** Calculate available balance for a coach (in minor units) */
async function getAvailableBalance(userId: string): Promise<number> {
  // Sum of available earnings (status='available' and available_at ≤ now)
  const { data: availableEarnings } = await supabase
    .from('earnings')
    .select('net_amount')
    .eq('user_id', userId)
    .eq('status', 'available')
    .lte('available_at', new Date().toISOString());

  const availableTotal = (availableEarnings ?? []).reduce(
    (sum: number, e: Record<string, number>) => sum + (e.net_amount ?? 0),
    0
  );

  // Subtract pending payout requests (status='requested' or 'approved')
  const { data: activePayout } = await supabase
    .from('payout_requests')
    .select('amount')
    .eq('user_id', userId)
    .in('status', ['requested', 'approved']);

  const payoutTotal = (activePayout ?? []).reduce(
    (sum: number, p: Record<string, number>) => sum + (p.amount ?? 0),
    0
  );

  return Math.max(0, availableTotal - payoutTotal);
}

/** GET /api/payouts — List payout requests (admin sees all, user sees own) */
export async function GET(request: NextRequest): Promise<NextResponse<PayoutsResponse | { error: string }>> {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);

  if (role === 'admin') {
    // Admin sees all payouts with coach names
    const { data, error } = await supabase
      .from('payout_requests')
      .select('*, profiles:user_id(full_name)')
      .order('requested_at', { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const payouts = (data as unknown as PayoutRequest[]) ?? [];
    return NextResponse.json({ payouts, available_balance: 0 });
  }

  // Coach sees own payouts
  const { data, error } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('requested_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const balance = await getAvailableBalance(user.id);
  const payouts = (data as unknown as PayoutRequest[]) ?? [];
  return NextResponse.json({ payouts, available_balance: balance });
}

/** POST /api/payouts — Coach requests a payout */
export async function POST(request: NextRequest): Promise<NextResponse<PayoutResponse | { error: string; available_balance?: number; requested?: number }>> {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as PayoutRequestPayload;
  const { amount, currency = 'AED', bank_details } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  if (!bank_details?.bank_name || !bank_details?.iban || !bank_details?.account_name) {
    return NextResponse.json(
      { error: 'Bank details required (bank_name, iban, account_name)' },
      { status: 400 }
    );
  }

  // Validate available balance
  const available = await getAvailableBalance(user.id);
  if (amount > available) {
    return NextResponse.json(
      {
        error: 'Insufficient balance',
        available_balance: available,
        requested: amount,
      },
      { status: 400 }
    );
  }

  const { data: payoutData, error } = await supabase
    .from('payout_requests')
    .insert({
      user_id: user.id,
      amount,
      currency,
      status: 'requested',
      bank_details,
      requested_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const payout = payoutData as unknown as PayoutRequest;
  return NextResponse.json({ payout }, { status: 201 });
}

/** PATCH /api/payouts — Admin action on payout (approve/reject/complete) */
export async function PATCH(request: NextRequest): Promise<NextResponse<PayoutResponse | { error: string }>> {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json()) as PayoutActionPayload;
  const { payout_id, action, admin_note } = body;

  if (!payout_id || !action) {
    return NextResponse.json({ error: 'Missing payout_id or action' }, { status: 400 });
  }

  if (!['approve', 'reject', 'complete'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Must be approve, reject, or complete.' }, { status: 400 });
  }

  // Get the payout
  const { data: payoutData, error: fetchError } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('id', payout_id)
    .single();

  if (fetchError || !payoutData) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
  }

  const payout = payoutData as unknown as PayoutRequest;

  // Map actions to status values
  const statusMap: Record<string, 'approved' | 'rejected' | 'processed'> = {
    approve: 'approved',
    reject: 'rejected',
    complete: 'processed', // DB schema uses 'processed' for completed payouts
  };

  const updateData: Record<string, unknown> = {
    status: statusMap[action],
    admin_note: admin_note || payout.admin_note || null,
    processed_by: user.id,
  };

  // Set processed_at timestamp for terminal states
  if (action === 'complete' || action === 'reject') {
    updateData.processed_at = new Date().toISOString();
  }

  const { data: updatedData, error } = await supabase
    .from('payout_requests')
    .update(updateData)
    .eq('id', payout_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updated = updatedData as unknown as PayoutRequest;

  // On complete: mark associated earnings as paid_out
  if (action === 'complete') {
    // Accumulate available earnings until we've covered the payout amount
    const { data: availableEarningsData } = await supabase
      .from('earnings')
      .select('id, net_amount')
      .eq('user_id', payout.user_id)
      .eq('status', 'available')
      .lte('available_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    const availableEarnings = availableEarningsData as unknown as Array<Record<string, unknown>> | null;
    let remaining = payout.amount;
    const earningIds: string[] = [];

    for (const e of (availableEarnings ?? [])) {
      if (remaining <= 0) break;
      earningIds.push(String(e.id));
      remaining -= Number(e.net_amount);
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
