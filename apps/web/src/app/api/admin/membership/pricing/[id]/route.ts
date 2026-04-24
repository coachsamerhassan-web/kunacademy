/**
 * /api/admin/membership/pricing/[id] — Wave F.3.
 *
 * PATCH updates value_cents (+ optional reason) and writes BOTH
 * pricing_config_audit (domain-specific) + content_edits (unified) rows in
 * the same transaction as the UPDATE.
 *
 * DELETE removes the row; audit trail preserved (DELETE writes a
 * content_edits sentinel + pricing_config_audit row with new_value_cents=null).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { pricing_config, pricing_config_audit, content_edits } from '@kunacademy/db/schema';
import { eq, sql } from 'drizzle-orm';
import { validatePricingBody, type PricingInsertBody } from '../route';
import { checkOrigin } from '../../tiers/route';

// DeepSeek F.3 MEDIUM-#1: FOR UPDATE on read-before-write inside PATCH
// transactions. Prevents audit trail corruption under concurrent edits.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const row = await withAdminContext(async (adminDb) => {
    const rows = await adminDb.select().from(pricing_config).where(eq(pricing_config.id, id)).limit(1);
    return rows[0] ?? null;
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ row });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: Partial<PricingInsertBody>;
  try {
    body = (await request.json()) as Partial<PricingInsertBody>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }
  // entity_type/entity_key/currency are identifier columns — not patchable here.
  if (body.entity_type !== undefined || body.entity_key !== undefined || body.currency !== undefined) {
    return NextResponse.json(
      { error: 'entity_type, entity_key, currency are immutable. Delete + recreate to change identifiers.' },
      { status: 400 },
    );
  }
  const validation = validatePricingBody(body, false);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await withAdminContext(async (adminDb) => {
      // Row-level lock (DeepSeek MED-1)
      const { rows: lockedRows } = await adminDb.execute(
        sql`SELECT * FROM pricing_config WHERE id = ${id} FOR UPDATE`,
      );
      const currentRow = (lockedRows?.[0] ?? null) as Record<string, unknown> | null;
      if (!currentRow) return { notFound: true as const };

      const curValueCents = (currentRow.value_cents ?? null) as number | null;
      const hasValueChange = body.value_cents !== undefined &&
        (body.value_cents ?? null) !== curValueCents;

      if (!hasValueChange) {
        return {
          notFound: false as const,
          noop: true as const,
          row: currentRow,
        };
      }

      const oldVal = curValueCents;
      const newVal = body.value_cents ?? null;

      await adminDb
        .update(pricing_config)
        .set({
          value_cents: newVal,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .where(eq(pricing_config.id, id));

      await adminDb.insert(pricing_config_audit).values({
        entity_type: currentRow.entity_type as string,
        entity_key: currentRow.entity_key as string,
        old_value_cents: oldVal,
        new_value_cents: newVal,
        changed_by: user.id,
        reason: body.reason ?? null,
      });

      await adminDb.insert(content_edits).values({
        entity: 'pricing_config',
        entity_id: id,
        field: 'value_cents',
        editor_type: 'human',
        editor_id: user.id,
        editor_name: user.email,
        previous_value: oldVal as never,
        new_value: newVal as never,
        change_kind: 'scalar',
        reason: body.reason ?? null,
        edit_source: 'admin_ui',
      });

      const freshRows = await adminDb.select().from(pricing_config).where(eq(pricing_config.id, id)).limit(1);
      return { notFound: false as const, noop: false as const, row: freshRows[0] };
    });

    if (result.notFound) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ row: result.row, noop: 'noop' in result ? result.noop : false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('check') || msg.includes('23514')) {
      return NextResponse.json({ error: 'Value violates pricing_config CHECK constraint' }, { status: 400 });
    }
    console.error('[api/admin/membership/pricing PATCH]', e);
    return NextResponse.json({ error: 'Could not update pricing row' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const result = await withAdminContext(async (adminDb) => {
      const cur = await adminDb.select().from(pricing_config).where(eq(pricing_config.id, id)).limit(1);
      if (!cur[0]) return { notFound: true as const };

      const row = cur[0];
      await adminDb.delete(pricing_config).where(eq(pricing_config.id, id));

      await adminDb.insert(pricing_config_audit).values({
        entity_type: row.entity_type,
        entity_key: row.entity_key,
        old_value_cents: row.value_cents,
        new_value_cents: null,
        changed_by: user.id,
        reason: `Deleted pricing row ${row.entity_type}/${row.entity_key}/${row.currency ?? 'NULL'}`,
      });

      await adminDb.insert(content_edits).values({
        entity: 'pricing_config',
        entity_id: id,
        field: '__delete__',
        editor_type: 'human',
        editor_id: user.id,
        editor_name: user.email,
        previous_value: {
          entity_type: row.entity_type,
          entity_key: row.entity_key,
          currency: row.currency,
          value_cents: row.value_cents,
        } as never,
        new_value: null,
        change_kind: 'scalar',
        reason: `Deleted pricing row`,
        edit_source: 'admin_ui',
      });

      return { deleted: true as const };
    });

    if ('notFound' in result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ deleted: id });
  } catch (e) {
    console.error('[api/admin/membership/pricing DELETE]', e);
    return NextResponse.json({ error: 'Could not delete pricing row' }, { status: 500 });
  }
}
