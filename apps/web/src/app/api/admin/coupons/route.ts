/**
 * /api/admin/coupons — Wave F.5
 *
 * GET   — list all coupons (admin)
 * POST  — create a coupon
 *
 * Auth: admin / super_admin role via getAuthUser(). Unauthed → 401; non-admin → 403.
 * Writes go through withAdminContext (kunacademy_admin role).
 *
 * IP protection: description text is admin-only and never exposed on landing
 * pages or marketing surfaces. The pre-commit `lint-dignity-framing.ts` hook
 * still runs to catch program-methodology language.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const CODE_RE       = /^[A-Z0-9][A-Z0-9-]{3,31}$/;
const SCOPE_KINDS   = new Set(['all', 'programs', 'tiers']);
const TYPES         = new Set(['percentage', 'fixed']);
const CURRENCIES    = new Set(['AED', 'EGP', 'USD', 'EUR']);
const UUID_RE       = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

interface CouponBody {
  code?: string;
  type?: 'percentage' | 'fixed';
  value?: number;
  currency?: string | null;
  redemptions_max?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  single_use_per_customer?: boolean;
  scope_kind?: 'all' | 'programs' | 'tiers';
  scope_program_ids?: string[];
  scope_tier_ids?: string[];
  admin_override?: boolean;
  is_active?: boolean;
  description?: string | null;
}

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

function validateCouponBody(body: CouponBody, requireAll: boolean): { ok: true } | { error: string } {
  if (requireAll || body.code !== undefined) {
    if (!body.code || typeof body.code !== 'string') return { error: 'code is required' };
    const code = body.code.toUpperCase().trim();
    if (!CODE_RE.test(code)) {
      return { error: 'code must match ^[A-Z0-9][A-Z0-9-]{3,31}$' };
    }
  }
  if (requireAll || body.type !== undefined) {
    if (!body.type || !TYPES.has(body.type)) return { error: 'type must be percentage|fixed' };
  }
  if (requireAll || body.value !== undefined) {
    if (!Number.isInteger(body.value) || (body.value as number) <= 0) {
      return { error: 'value must be positive integer' };
    }
    if (body.type === 'percentage' && ((body.value as number) < 1 || (body.value as number) > 100)) {
      return { error: 'value for percentage must be 1..100' };
    }
  }
  if (body.type === 'fixed') {
    if (!body.currency || !CURRENCIES.has(body.currency)) {
      return { error: 'currency required for fixed coupons (AED|EGP|USD|EUR)' };
    }
  }
  if (body.currency !== undefined && body.currency !== null) {
    if (!CURRENCIES.has(body.currency)) return { error: 'currency must be AED|EGP|USD|EUR' };
  }
  if (body.redemptions_max !== undefined && body.redemptions_max !== null) {
    if (!Number.isInteger(body.redemptions_max) || (body.redemptions_max as number) <= 0) {
      return { error: 'redemptions_max must be positive integer or null' };
    }
  }
  if (body.scope_kind !== undefined) {
    if (!SCOPE_KINDS.has(body.scope_kind)) return { error: 'scope_kind must be all|programs|tiers' };
  }
  if (body.scope_program_ids !== undefined) {
    if (!Array.isArray(body.scope_program_ids)) return { error: 'scope_program_ids must be array' };
    for (const id of body.scope_program_ids) {
      if (typeof id !== 'string' || !UUID_RE.test(id)) {
        return { error: 'scope_program_ids must be array of UUIDs' };
      }
    }
  }
  if (body.scope_tier_ids !== undefined) {
    if (!Array.isArray(body.scope_tier_ids)) return { error: 'scope_tier_ids must be array' };
    for (const id of body.scope_tier_ids) {
      if (typeof id !== 'string' || !UUID_RE.test(id)) {
        return { error: 'scope_tier_ids must be array of UUIDs' };
      }
    }
  }
  if (body.valid_from !== undefined && body.valid_from !== null) {
    if (Number.isNaN(new Date(body.valid_from).getTime())) {
      return { error: 'valid_from must be ISO date or null' };
    }
  }
  if (body.valid_to !== undefined && body.valid_to !== null) {
    if (Number.isNaN(new Date(body.valid_to).getTime())) {
      return { error: 'valid_to must be ISO date or null' };
    }
  }
  if (
    body.valid_from && body.valid_to
    && new Date(body.valid_to).getTime() <= new Date(body.valid_from).getTime()
  ) {
    return { error: 'valid_to must be after valid_from' };
  }
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 500) {
      return { error: 'description must be string ≤500 chars' };
    }
  }
  for (const f of ['single_use_per_customer', 'admin_override', 'is_active'] as const) {
    if (body[f] !== undefined && typeof body[f] !== 'boolean') {
      return { error: `${f} must be boolean` };
    }
  }
  return { ok: true };
}

// ── GET /api/admin/coupons ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Optional ?include_inactive=1 — admin sees inactive coupons by default
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get('include_inactive') !== '0';

  const rows = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT id, code, type, value, currency, redemptions_max, redemptions_used,
             valid_from, valid_to, single_use_per_customer, scope_kind,
             scope_program_ids, scope_tier_ids, admin_override, is_active,
             description, created_by, created_at, updated_at
      FROM coupons
      WHERE ${sql.raw(includeInactive ? 'true' : 'is_active = true')}
      ORDER BY created_at DESC
    `);
    return rows;
  });

  return NextResponse.json({ coupons: rows });
}

// ── POST /api/admin/coupons ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: CouponBody;
  try {
    body = (await request.json()) as CouponBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const validation = validateCouponBody(body, true);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const code = body.code!.toUpperCase().trim();
  const type = body.type!;
  const value = body.value!;
  const currency = type === 'fixed' ? body.currency! : (body.currency ?? null);
  const scopeKind = body.scope_kind ?? 'all';

  try {
    const inserted = await withAdminContext(async (db) => {
      const { rows } = await db.execute(sql`
        INSERT INTO coupons (
          code, type, value, currency,
          redemptions_max, redemptions_used,
          valid_from, valid_to,
          single_use_per_customer,
          scope_kind, scope_program_ids, scope_tier_ids,
          admin_override, is_active, description, created_by
        ) VALUES (
          ${code}, ${type}, ${value}::int, ${currency},
          ${body.redemptions_max ?? null}, 0,
          ${body.valid_from ?? null}, ${body.valid_to ?? null},
          ${body.single_use_per_customer ?? false},
          ${scopeKind},
          ${body.scope_program_ids ?? []}::uuid[],
          ${body.scope_tier_ids ?? []}::uuid[],
          ${body.admin_override ?? false},
          ${body.is_active ?? true},
          ${body.description ?? null},
          ${user.id}::uuid
        )
        RETURNING id, code, type, value, currency,
                  redemptions_max, redemptions_used,
                  valid_from, valid_to, single_use_per_customer,
                  scope_kind, scope_program_ids, scope_tier_ids,
                  admin_override, is_active, description,
                  created_by, created_at, updated_at
      `);
      return rows[0];
    });
    return NextResponse.json({ coupon: inserted }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes('23505')) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 });
    }
    if (msg.includes('coupons_validity_order_chk')) {
      return NextResponse.json({ error: 'valid_to must be after valid_from' }, { status: 400 });
    }
    if (msg.includes('coupons_percentage_range_chk')) {
      return NextResponse.json({ error: 'percentage value must be 1..100' }, { status: 400 });
    }
    if (msg.includes('coupons_fixed_currency_chk')) {
      return NextResponse.json({ error: 'fixed coupons require currency' }, { status: 400 });
    }
    if (msg.includes('coupons_code_check') || msg.includes('coupons_code')) {
      return NextResponse.json({ error: 'invalid code format' }, { status: 400 });
    }
    console.error('[api/admin/coupons POST]', e);
    return NextResponse.json({ error: 'Could not create coupon' }, { status: 500 });
  }
}
