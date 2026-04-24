/**
 * /api/admin/membership/pricing — Wave F.3 pricing_config list + create.
 *
 * F.1 ships a simpler shape than spec §5.5 (no description_ar/en, no
 * value_numeric, no value_text, no is_active). F.3 binds to shipped cols.
 * Percentages are stored as value_cents where 1000 = 10.00% (per F.1 seed).
 *
 * Every PATCH/DELETE writes BOTH a content_edits row (unified audit) AND
 * a pricing_config_audit row (F.1 domain-specific audit) in same txn.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { pricing_config, pricing_config_audit, content_edits } from '@kunacademy/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { checkOrigin } from '../tiers/route';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

// F.1 constraint: snake_case on entity_type + entity_key
const SNAKE_RE = /^[a-z][a-z0-9_]{0,63}$/;
// pricing_config CHECK (per F.1) limits currency to [AED, EGP, EUR, USD] or NULL
const CURRENCY_RE = /^(AED|EGP|EUR|USD)$/;

export interface PricingInsertBody {
  entity_type: string;
  entity_key: string;
  value_cents?: number | null;
  currency?: string | null;
  reason?: string | null;
}

export function validatePricingBody(body: Partial<PricingInsertBody>, requireAll: boolean) {
  if (requireAll || body.entity_type !== undefined) {
    if (!body.entity_type || typeof body.entity_type !== 'string' || !SNAKE_RE.test(body.entity_type)) {
      return { error: 'entity_type must be snake_case' };
    }
  }
  if (requireAll || body.entity_key !== undefined) {
    if (!body.entity_key || typeof body.entity_key !== 'string' || body.entity_key.length > 128) {
      return { error: 'entity_key required (max 128 chars)' };
    }
  }
  if (body.value_cents !== undefined && body.value_cents !== null) {
    if (!Number.isInteger(body.value_cents) || (body.value_cents as number) < 0) {
      return { error: 'value_cents must be non-negative integer' };
    }
  }
  if (body.currency !== undefined && body.currency !== null) {
    if (typeof body.currency !== 'string' || !CURRENCY_RE.test(body.currency)) {
      return { error: 'currency must be AED|EGP|EUR|USD|null' };
    }
  }
  if (body.reason !== undefined && body.reason !== null) {
    if (typeof body.reason !== 'string' || body.reason.length > 500) {
      return { error: 'reason must be string ≤500' };
    }
  }
  return { ok: true as const };
}

// ── GET — list all pricing rows ────────────────────────────────────────────
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await withAdminContext(async (adminDb) =>
    adminDb
      .select()
      .from(pricing_config)
      .orderBy(pricing_config.entity_type, pricing_config.entity_key),
  );

  return NextResponse.json({ pricing: rows });
}

// ── POST — create a new pricing row ────────────────────────────────────────
export async function POST(request: NextRequest) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: PricingInsertBody;
  try {
    body = (await request.json()) as PricingInsertBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }
  const validation = validatePricingBody(body, true);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const inserted = await withAdminContext(async (adminDb) => {
      const rows = await adminDb
        .insert(pricing_config)
        .values({
          entity_type: body.entity_type,
          entity_key: body.entity_key,
          value_cents: body.value_cents ?? null,
          currency: body.currency ?? null,
          updated_by: user.id,
        })
        .returning({
          id: pricing_config.id,
          entity_type: pricing_config.entity_type,
          entity_key: pricing_config.entity_key,
        });
      const row = rows[0];

      await adminDb.insert(pricing_config_audit).values({
        entity_type: body.entity_type,
        entity_key: body.entity_key,
        old_value_cents: null,
        new_value_cents: body.value_cents ?? null,
        changed_by: user.id,
        reason: body.reason ?? `Created pricing ${body.entity_type}/${body.entity_key}`,
      });

      await adminDb.insert(content_edits).values({
        entity: 'pricing_config',
        entity_id: row.id,
        field: '__create__',
        editor_type: 'human',
        editor_id: user.id,
        editor_name: user.email,
        previous_value: null,
        new_value: {
          entity_type: body.entity_type,
          entity_key: body.entity_key,
          value_cents: body.value_cents ?? null,
          currency: body.currency ?? null,
        } as never,
        change_kind: 'scalar',
        reason: body.reason ?? `Created pricing ${body.entity_type}/${body.entity_key}`,
        edit_source: 'admin_ui',
      });

      return row;
    });
    return NextResponse.json({ row: inserted }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes('unique') || msg.includes('23505')) {
      return NextResponse.json(
        { error: 'A pricing row with this (entity_type, entity_key, currency) already exists' },
        { status: 409 },
      );
    }
    if (msg.includes('check') || msg.includes('23514')) {
      return NextResponse.json({ error: 'Value violates pricing_config CHECK constraint' }, { status: 400 });
    }
    console.error('[api/admin/membership/pricing POST]', e);
    return NextResponse.json({ error: 'Could not create pricing row' }, { status: 500 });
  }
}
