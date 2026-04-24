/**
 * /api/admin/membership/tiers/[id] — Wave F.3. GET/PATCH/DELETE one tier.
 *
 * PATCH writes one content_edits row per field changed in the SAME
 * transaction as the UPDATE. If the audit insert fails, the UPDATE rolls
 * back — we never leave an unlogged mutation.
 *
 * DELETE guards: refuses 409 if tier has active memberships. Tiers also
 * cascade-delete tier_features rows — that's fine (the matrix re-reads
 * server state after any op).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { tiers, memberships, content_edits } from '@kunacademy/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

// DeepSeek F.3 MEDIUM-#1: row-level lock on the read-before-write inside
// a PATCH transaction prevents two concurrent admins from computing diffs
// off a stale snapshot. Without this, audit trail can record A→C when
// actual sequence was A→B→C. Applied on tiers, features, pricing.
import { validateTierBody, checkOrigin, type TierInsertBody } from '../route';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

// Columns we allow to be PATCHed. Creating an allowlist instead of trusting
// the body prevents mass-assignment of stripe_*, id, timestamps.
const PATCHABLE_COLS = [
  'slug',
  'name_ar',
  'name_en',
  'description_ar',
  'description_en',
  'price_monthly_cents',
  'price_annual_cents',
  'currency',
  'sort_order',
  'is_public',
  'is_active',
] as const;

type PatchableCol = (typeof PATCHABLE_COLS)[number];

// ── GET /[id] ───────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { tier, activeMembers } = await withAdminContext(async (adminDb) => {
    const rows = await adminDb.select().from(tiers).where(eq(tiers.id, id)).limit(1);
    const tier = rows[0] ?? null;
    if (!tier) return { tier: null, activeMembers: 0 };
    const cntRows = await adminDb
      .select({ n: sql<number>`count(*)::int` })
      .from(memberships)
      .where(and(eq(memberships.tier_id, id), isNull(memberships.ended_at)));
    return { tier, activeMembers: cntRows[0]?.n ?? 0 };
  });

  if (!tier) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ tier, active_members: activeMembers });
}

// ── PATCH /[id] ─────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: Partial<TierInsertBody>;
  try {
    body = (await request.json()) as Partial<TierInsertBody>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }
  const validation = validateTierBody(body, false);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Build SET clause from allowlist only
  const setClause: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const col of PATCHABLE_COLS) {
    if (body[col] !== undefined) setClause[col] = body[col];
  }
  if (Object.keys(setClause).length === 1) {
    // Only updated_at was set — caller sent no patchable fields.
    return NextResponse.json({ error: 'No patchable fields supplied' }, { status: 400 });
  }

  try {
    const result = await withAdminContext(async (adminDb) => {
      // Row-level lock for concurrent-PATCH safety (DeepSeek MED-1).
      // Without FOR UPDATE, two admins PATCHing the same tier can produce
      // A→C audit when actual was A→B→C.
      const { rows: lockedRows } = await adminDb.execute(
        sql`SELECT * FROM tiers WHERE id = ${id} FOR UPDATE`,
      );
      const currentRow = (lockedRows?.[0] ?? null) as Record<string, unknown> | null;
      if (!currentRow) return { notFound: true as const };

      // Compute diff
      const diffs: Array<{ field: PatchableCol; previous: unknown; next: unknown }> = [];
      for (const col of PATCHABLE_COLS) {
        if (body[col] === undefined) continue;
        const prev = (currentRow as Record<string, unknown>)[col];
        const next = body[col];
        if (JSON.stringify(prev) === JSON.stringify(next)) continue;
        diffs.push({ field: col, previous: prev, next });
      }

      if (diffs.length === 0) {
        return {
          notFound: false as const,
          noop: true as const,
          id: currentRow.id as string,
          slug: currentRow.slug as string,
        };
      }

      await adminDb.update(tiers).set(setClause).where(eq(tiers.id, id));

      for (const d of diffs) {
        await adminDb.insert(content_edits).values({
          entity: 'tiers',
          entity_id: id,
          field: d.field,
          editor_type: 'human',
          editor_id: user.id,
          editor_name: user.email,
          previous_value: d.previous as never,
          new_value: d.next as never,
          change_kind: 'scalar',
          edit_source: 'admin_ui',
        });
      }

      return {
        notFound: false as const,
        noop: false as const,
        id: currentRow.id as string,
        slug: (body.slug as string | undefined) ?? (currentRow.slug as string),
        changes: diffs.length,
      };
    });

    if (result.notFound) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      tier: { id: result.id, slug: result.slug },
      changes: 'changes' in result ? result.changes : 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes('unique') || msg.includes('23505')) {
      return NextResponse.json({ error: 'A tier with this slug already exists' }, { status: 409 });
    }
    console.error('[api/admin/membership/tiers PATCH]', e);
    return NextResponse.json({ error: 'Could not update tier' }, { status: 500 });
  }
}

// ── DELETE /[id] ────────────────────────────────────────────────────────────
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
      // Guard: refuse if any active membership references this tier
      const active = await adminDb
        .select({ n: sql<number>`count(*)::int` })
        .from(memberships)
        .where(and(eq(memberships.tier_id, id), isNull(memberships.ended_at)));
      if ((active[0]?.n ?? 0) > 0) {
        return { blocked: true as const, count: active[0].n };
      }

      const cur = await adminDb.select({ slug: tiers.slug }).from(tiers).where(eq(tiers.id, id)).limit(1);
      if (!cur[0]) return { notFound: true as const };

      await adminDb.delete(tiers).where(eq(tiers.id, id));

      // Audit
      await adminDb.insert(content_edits).values({
        entity: 'tiers',
        entity_id: id,
        field: '__delete__',
        editor_type: 'human',
        editor_id: user.id,
        editor_name: user.email,
        previous_value: { slug: cur[0].slug } as never,
        new_value: null,
        change_kind: 'scalar',
        reason: `Deleted tier ${cur[0].slug}`,
        edit_source: 'admin_ui',
      });

      return { deleted: true as const, slug: cur[0].slug };
    });

    if ('notFound' in result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ('blocked' in result) {
      return NextResponse.json(
        { error: `Cannot delete: ${result.count} active membership(s) reference this tier` },
        { status: 409 },
      );
    }
    return NextResponse.json({ deleted: id });
  } catch (e) {
    console.error('[api/admin/membership/tiers DELETE]', e);
    return NextResponse.json({ error: 'Could not delete tier' }, { status: 500 });
  }
}
