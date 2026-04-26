/**
 * /api/admin/coupons/[id] — Wave F.5
 *
 * GET    — fetch a single coupon
 * PATCH  — update mutable fields
 * DELETE — soft-deactivate (sets is_active = false; preserves redemption history)
 *
 * Hard delete is intentionally NOT supported — coupon_redemptions FK CASCADEs,
 * which would lose audit trail. Use is_active=false instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CURRENCIES = new Set(['AED', 'EGP', 'USD', 'EUR']);

function checkOrigin(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') return null;
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const host = request.headers.get('host');
  if (!host) return NextResponse.json({ error: 'Host header required' }, { status: 400 });
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return NextResponse.json({ error: 'Cross-origin request denied' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid Origin header' }, { status: 400 });
  }
  return null;
}

// ── GET /api/admin/coupons/[id] ─────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const row = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT * FROM coupons WHERE id = ${id}::uuid LIMIT 1
    `);
    return rows[0];
  });

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ coupon: row });
}

// ── PATCH /api/admin/coupons/[id] ───────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Whitelist mutable fields. `code` and `type` and `value` and `currency` are
  // intentionally NOT mutable — they belong to the contract printed on the
  // promotion. To change them, deactivate + create a new coupon.
  const MUTABLE = [
    'redemptions_max',
    'valid_from',
    'valid_to',
    'single_use_per_customer',
    'scope_kind',
    'scope_program_ids',
    'scope_tier_ids',
    'admin_override',
    'is_active',
    'description',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const k of MUTABLE) {
    if (k in body) updates[k] = (body as any)[k];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  // Per-field validation (light; DB CHECK constraints catch the rest)
  if ('redemptions_max' in updates && updates.redemptions_max !== null) {
    if (!Number.isInteger(updates.redemptions_max) || (updates.redemptions_max as number) <= 0) {
      return NextResponse.json({ error: 'redemptions_max must be positive integer or null' }, { status: 400 });
    }
  }
  if ('description' in updates && updates.description !== null) {
    if (typeof updates.description !== 'string' || (updates.description as string).length > 500) {
      return NextResponse.json({ error: 'description must be string ≤500' }, { status: 400 });
    }
  }
  for (const f of ['valid_from', 'valid_to'] as const) {
    if (f in updates && updates[f] !== null) {
      if (Number.isNaN(new Date(updates[f] as string).getTime())) {
        return NextResponse.json({ error: `${f} must be ISO date or null` }, { status: 400 });
      }
    }
  }

  // Build the SET clause dynamically and safely
  const setParts: ReturnType<typeof sql>[] = [];
  if ('redemptions_max' in updates) {
    setParts.push(sql`redemptions_max = ${updates.redemptions_max as number | null}`);
  }
  if ('valid_from' in updates) {
    setParts.push(sql`valid_from = ${updates.valid_from as string | null}`);
  }
  if ('valid_to' in updates) {
    setParts.push(sql`valid_to = ${updates.valid_to as string | null}`);
  }
  if ('single_use_per_customer' in updates) {
    setParts.push(sql`single_use_per_customer = ${Boolean(updates.single_use_per_customer)}`);
  }
  if ('scope_kind' in updates) {
    const v = String(updates.scope_kind);
    if (!['all', 'programs', 'tiers'].includes(v)) {
      return NextResponse.json({ error: 'scope_kind must be all|programs|tiers' }, { status: 400 });
    }
    setParts.push(sql`scope_kind = ${v}`);
  }
  if ('scope_program_ids' in updates) {
    const arr = Array.isArray(updates.scope_program_ids) ? (updates.scope_program_ids as string[]) : [];
    for (const sid of arr) if (!UUID_RE.test(sid)) {
      return NextResponse.json({ error: 'scope_program_ids must be UUIDs' }, { status: 400 });
    }
    setParts.push(sql`scope_program_ids = ${arr}::uuid[]`);
  }
  if ('scope_tier_ids' in updates) {
    const arr = Array.isArray(updates.scope_tier_ids) ? (updates.scope_tier_ids as string[]) : [];
    for (const sid of arr) if (!UUID_RE.test(sid)) {
      return NextResponse.json({ error: 'scope_tier_ids must be UUIDs' }, { status: 400 });
    }
    setParts.push(sql`scope_tier_ids = ${arr}::uuid[]`);
  }
  if ('admin_override' in updates) {
    setParts.push(sql`admin_override = ${Boolean(updates.admin_override)}`);
  }
  if ('is_active' in updates) {
    setParts.push(sql`is_active = ${Boolean(updates.is_active)}`);
  }
  if ('description' in updates) {
    setParts.push(sql`description = ${(updates.description as string | null) ?? null}`);
  }

  // Compose comma-separated SQL parts
  let setClause = setParts[0];
  for (let i = 1; i < setParts.length; i++) {
    setClause = sql`${setClause}, ${setParts[i]}`;
  }

  try {
    const updated = await withAdminContext(async (db) => {
      const { rows } = await db.execute(sql`
        UPDATE coupons SET ${setClause}, updated_at = now()
        WHERE id = ${id}::uuid
        RETURNING *
      `);
      return rows[0];
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ coupon: updated });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes('coupons_validity_order_chk')) {
      return NextResponse.json({ error: 'valid_to must be after valid_from' }, { status: 400 });
    }
    console.error('[api/admin/coupons/[id] PATCH]', e);
    return NextResponse.json({ error: 'Could not update coupon' }, { status: 500 });
  }
}

// ── DELETE /api/admin/coupons/[id] ──────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const updated = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      UPDATE coupons SET is_active = false, updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING id
    `);
    return rows[0];
  });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
