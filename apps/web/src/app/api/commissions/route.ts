import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { isAdminRole, getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';
import type {
  CommissionRate,
  CommissionRatePayload,
  CommissionsResponse,
  EarningPayload,
  EarningResponse,
} from '@/types/commission-system';

async function getUserRole(userId: string): Promise<string | undefined> {
  const profile = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`SELECT role FROM profiles WHERE id = ${userId} LIMIT 1`
    );
    return rows.rows[0] as { role: string } | undefined;
  });
  return profile?.role ?? undefined;
}

/** GET /api/commissions — Return commission rates */
export async function GET(request: NextRequest): Promise<NextResponse<CommissionsResponse | { error: string }>> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);

  if (isAdminRole(role)) {
    // Admin sees all rates
    const rates = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT * FROM commission_rates ORDER BY scope ASC`
      );
      return rows.rows as unknown as CommissionRate[];
    });
    return NextResponse.json({ rates: rates ?? [] });
  }

  // Coach sees global rates + their own overrides
  const globalRates = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`SELECT * FROM commission_rates WHERE scope = 'global'`
    );
    return rows.rows as unknown as CommissionRate[];
  });

  const coachOverrides = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`SELECT * FROM commission_rates WHERE scope = 'coach' AND scope_id = ${user.id}`
    );
    return rows.rows as unknown as CommissionRate[];
  });

  const rates: CommissionRate[] = [
    ...(globalRates ?? []),
    ...(coachOverrides ?? []),
  ];

  return NextResponse.json({ rates });
}

/** POST /api/commissions — Record a new earning (admin only) */
export async function POST(request: NextRequest): Promise<NextResponse<EarningResponse | { error: string }>> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!isAdminRole(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json()) as EarningPayload;
  const { source_type, source_id, coach_id, gross_amount, currency = 'AED' } = body;

  if (!source_type || !source_id || !coach_id || !gross_amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Rate lookup chain (3-tier): coach-specific → product/service-specific → global
  let rate: number | null = null;

  // 1. Coach-specific override
  const coachRateData = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`SELECT rate_pct FROM commission_rates WHERE scope = 'coach' AND scope_id = ${coach_id} LIMIT 1`
    );
    return rows.rows[0] as { rate_pct: number } | undefined;
  });
  if (coachRateData) {
    rate = Number(coachRateData.rate_pct);
  }

  // 2. Product/service-specific (item-level rate)
  if (rate === null) {
    const targetScope = source_type === 'service_booking' ? 'service' : 'product';
    const itemRateData = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT rate_pct FROM commission_rates WHERE scope = ${targetScope} AND scope_id = ${source_id} LIMIT 1`
      );
      return rows.rows[0] as { rate_pct: number } | undefined;
    });
    if (itemRateData) {
      rate = Number(itemRateData.rate_pct);
    }
  }

  // 3. Global fallback (category-aware)
  if (rate === null) {
    const category = source_type === 'service_booking' ? 'services' : 'products';
    const globalRateData = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT rate_pct FROM commission_rates WHERE scope = 'global' AND category = ${category} AND scope_id IS NULL LIMIT 1`
      );
      return rows.rows[0] as { rate_pct: number } | undefined;
    });
    if (globalRateData) {
      rate = Number(globalRateData.rate_pct);
    }
  }

  if (rate === null) {
    return NextResponse.json({ error: 'No commission rate found' }, { status: 400 });
  }

  if (rate < 0 || rate > 100) {
    return NextResponse.json({ error: 'Invalid commission rate' }, { status: 400 });
  }

  // Calculate amounts in minor units
  const commission_amount = Math.round(gross_amount * rate / 100);
  const net_amount = commission_amount;
  const available_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const earning = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`
        INSERT INTO earnings (user_id, source_type, source_id, gross_amount, commission_pct, commission_amount, net_amount, currency, status, available_at)
        VALUES (${coach_id}, ${source_type}, ${source_id}, ${gross_amount}, ${rate}, ${commission_amount}, ${net_amount}, ${currency}, 'pending', ${available_at})
        RETURNING *
      `
    );
    return rows.rows[0] as any | undefined;
  });

  if (!earning) return NextResponse.json({ error: 'Failed to insert earning' }, { status: 500 });
  return NextResponse.json({ earning }, { status: 201 });
}

/** PATCH /api/commissions — Update commission rate (admin only) */
export async function PATCH(
  request: NextRequest
): Promise<NextResponse<{ rate: CommissionRate } | { error: string }>> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!isAdminRole(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json()) as CommissionRatePayload;
  const { scope, scope_id, rate_pct, category = 'services' } = body;

  if (!scope || rate_pct === undefined || rate_pct === null) {
    return NextResponse.json({ error: 'Missing scope or rate_pct' }, { status: 400 });
  }

  if (rate_pct < 0 || rate_pct > 100) {
    return NextResponse.json({ error: 'Rate must be between 0 and 100' }, { status: 400 });
  }

  // Upsert: find existing rate for this scope+scope_id+category
  const existing = await withAdminContext(async (db) => {
    let rows;
    if (scope_id) {
      rows = await db.execute(
        sql`SELECT id FROM commission_rates WHERE scope = ${scope} AND category = ${category} AND scope_id = ${scope_id} LIMIT 1`
      );
    } else {
      rows = await db.execute(
        sql`SELECT id FROM commission_rates WHERE scope = ${scope} AND category = ${category} AND scope_id IS NULL LIMIT 1`
      );
    }
    return rows.rows[0] as { id: string } | undefined;
  });

  if (existing) {
    // Update existing rate
    const updated = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`UPDATE commission_rates SET rate_pct = ${rate_pct} WHERE id = ${existing.id} RETURNING *`
      );
      return rows.rows[0] as unknown as CommissionRate | undefined;
    });
    if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json({ rate: updated });
  }

  // Insert new rate
  const inserted = await withAdminContext(async (db) => {
    const rows = await db.execute(
      sql`
        INSERT INTO commission_rates (scope, scope_id, rate_pct, category)
        VALUES (${scope}, ${scope_id ?? null}, ${rate_pct}, ${category})
        RETURNING *
      `
    );
    return rows.rows[0] as unknown as CommissionRate | undefined;
  });
  if (!inserted) return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  return NextResponse.json({ rate: inserted }, { status: 201 });
}

/** DELETE /api/commissions?id=xxx — Remove a commission rate by ID (admin only) */
export async function DELETE(request: NextRequest): Promise<NextResponse<{ success: boolean } | { error: string }>> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!isAdminRole(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await withAdminContext(async (db) => {
    await db.execute(sql`DELETE FROM commission_rates WHERE id = ${id}`);
  });

  return NextResponse.json({ success: true });
}
