import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, withUserContext } from '@kunacademy/db';
import { isAdminRole, getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';
import type {
  PayoutRequest,
  PayoutRequestPayload,
  PayoutActionPayload,
  PayoutsResponse,
  PayoutResponse,
} from '@/types/commission-system';

/** Calculate available balance for a coach (in minor units) */
async function getAvailableBalance(userId: string): Promise<number> {
  // Sum of available earnings (status='available' and available_at ≤ now)
  const earningsResult = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(net_amount), 0) AS total FROM earnings WHERE user_id = ${userId} AND status = 'available' AND available_at <= NOW()`
    );
    return rows.rows[0] as { total: number } | undefined;
  });
  const availableTotal = Number(earningsResult?.total ?? 0);

  // Subtract pending payout requests (status='requested' or 'approved')
  const payoutResult = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(amount), 0) AS total FROM payout_requests WHERE user_id = ${userId} AND status IN ('requested', 'approved')`
    );
    return rows.rows[0] as { total: number } | undefined;
  });
  const payoutTotal = Number(payoutResult?.total ?? 0);

  return Math.max(0, availableTotal - payoutTotal);
}

/** GET /api/payouts — List payout requests (admin sees all, user sees own) */
export async function GET(request: NextRequest): Promise<NextResponse<PayoutsResponse | { error: string }>> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isAdminRole(user.role)) {
    // Admin sees all payouts with coach names
    const data = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          SELECT pr.*, p.full_name_en AS profiles_full_name, p.full_name_ar AS profiles_full_name_ar, p.email AS profiles_email
          FROM payout_requests pr
          LEFT JOIN profiles p ON p.id = pr.user_id
          ORDER BY pr.created_at DESC
          LIMIT 200
        `
      );
      return rows.rows as unknown as PayoutRequest[];
    });
    return NextResponse.json({ payouts: data ?? [], available_balance: 0 });
  }

  // Coach sees own payouts
  const data = await withUserContext(user.id, async (db) => {
    const rows = await db.execute(
      sql`SELECT * FROM payout_requests WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 100`
    );
    return rows.rows as unknown as PayoutRequest[];
  });

  const balance = await getAvailableBalance(user.id);
  return NextResponse.json({ payouts: data ?? [], available_balance: balance });
}

/** POST /api/payouts — Coach requests a payout */
export async function POST(request: NextRequest): Promise<NextResponse<PayoutResponse | { error: string; available_balance?: number; requested?: number }>> {
  const user = await getAuthUser();
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

  const now = new Date().toISOString();
  const payout = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`
        INSERT INTO payout_requests (user_id, amount, currency, status, bank_details, created_at)
        VALUES (${user.id}, ${amount}, ${currency}, 'requested', ${JSON.stringify(bank_details)}, ${now})
        RETURNING *
      `
    );
    return rows.rows[0] as unknown as PayoutRequest | undefined;
  });

  if (!payout) return NextResponse.json({ error: 'Failed to create payout request' }, { status: 500 });
  return NextResponse.json({ payout }, { status: 201 });
}

/** PATCH /api/payouts — Admin action on payout (approve/reject/complete) */
export async function PATCH(request: NextRequest): Promise<NextResponse<PayoutResponse | { error: string }>> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json()) as PayoutActionPayload;
  const { payout_id, action, admin_note } = body;

  if (!payout_id || !action) {
    return NextResponse.json({ error: 'Missing payout_id or action' }, { status: 400 });
  }

  if (!['approve', 'reject', 'complete'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Must be approve, reject, or complete.' }, { status: 400 });
  }

  // Get the payout
  const payoutData = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`SELECT * FROM payout_requests WHERE id = ${payout_id} LIMIT 1`
    );
    return rows.rows[0] as unknown as PayoutRequest | undefined;
  });

  if (!payoutData) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
  }

  const payout = payoutData;

  // Map actions to status values
  const statusMap: Record<string, 'approved' | 'rejected' | 'processed'> = {
    approve: 'approved',
    reject: 'rejected',
    complete: 'processed', // DB schema uses 'processed' for completed payouts
  };

  const newStatus = statusMap[action];
  const processedAt = (action === 'complete' || action === 'reject') ? new Date().toISOString() : null;

  const updated = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`
        UPDATE payout_requests
        SET
          status = ${newStatus},
          admin_note = ${admin_note || payout.admin_note || null},
          processed_by = ${user.id},
          processed_at = ${processedAt}
        WHERE id = ${payout_id}
        RETURNING *
      `
    );
    return rows.rows[0] as unknown as PayoutRequest | undefined;
  });

  if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  // On complete: mark associated earnings as paid_out
  if (action === 'complete') {
    // Accumulate available earnings until we've covered the payout amount
    const availableEarnings = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          SELECT id, net_amount FROM earnings
          WHERE user_id = ${payout.user_id} AND status = 'available' AND available_at <= NOW()
          ORDER BY created_at ASC
        `
      );
      return rows.rows as Array<{ id: string; net_amount: number }>;
    });

    let remaining = payout.amount;
    const earningIds: string[] = [];

    for (const e of (availableEarnings ?? [])) {
      if (remaining <= 0) break;
      earningIds.push(String(e.id));
      remaining -= Number(e.net_amount);
    }

    if (earningIds.length > 0) {
      await withAdminContext(async (db) => {
        await db.execute(
          sql`UPDATE earnings SET status = 'paid_out' WHERE id = ANY(${earningIds}::uuid[])`
        );
      });
    }
  }

  return NextResponse.json({ payout: updated });
}
