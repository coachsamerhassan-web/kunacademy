/**
 * /api/admin/membership/features/[id] — Wave F.3.
 *
 * GET one, PATCH full-field, DELETE with tier_features reference guard.
 * Every PATCH writes one content_edits audit row per changed field.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { features, tier_features, content_edits } from '@kunacademy/db/schema';
import { and, eq, sql } from 'drizzle-orm';

// DeepSeek F.3 MEDIUM-#1: FOR UPDATE on read-before-write prevents
// concurrent PATCHes from recording A→C audit trail when actual was A→B→C.
import { validateFeatureBody, checkOrigin, type FeatureInsertBody } from '../route';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

// feature_key is intentionally NOT patchable — it's referenced by hasFeature()
// calls in code. Admin must delete+recreate to change the key.
const PATCHABLE_COLS = [
  'name_ar',
  'name_en',
  'description_ar',
  'description_en',
  'feature_type',
] as const;

type PatchableCol = (typeof PATCHABLE_COLS)[number];

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { feature, tiersCount } = await withAdminContext(async (adminDb) => {
    const rows = await adminDb.select().from(features).where(eq(features.id, id)).limit(1);
    const feature = rows[0] ?? null;
    if (!feature) return { feature: null, tiersCount: 0 };
    const cntRows = await adminDb
      .select({ n: sql<number>`count(*)::int` })
      .from(tier_features)
      .where(and(eq(tier_features.feature_id, id), eq(tier_features.included, true)));
    return { feature, tiersCount: cntRows[0]?.n ?? 0 };
  });

  if (!feature) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ feature, tiers_count: tiersCount });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: Partial<FeatureInsertBody>;
  try {
    body = (await request.json()) as Partial<FeatureInsertBody>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }
  // Reject attempts to change feature_key
  if (body.feature_key !== undefined) {
    return NextResponse.json(
      { error: 'feature_key is immutable — delete and recreate to change it' },
      { status: 400 },
    );
  }
  const validation = validateFeatureBody(body, false);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const setClause: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const col of PATCHABLE_COLS) {
    if (body[col] !== undefined) setClause[col] = body[col];
  }
  if (Object.keys(setClause).length === 1) {
    return NextResponse.json({ error: 'No patchable fields supplied' }, { status: 400 });
  }

  try {
    const result = await withAdminContext(async (adminDb) => {
      // Row-level lock (DeepSeek MED-1)
      const { rows: lockedRows } = await adminDb.execute(
        sql`SELECT * FROM features WHERE id = ${id} FOR UPDATE`,
      );
      const currentRow = (lockedRows?.[0] ?? null) as Record<string, unknown> | null;
      if (!currentRow) return { notFound: true as const };

      const diffs: Array<{ field: PatchableCol; previous: unknown; next: unknown }> = [];
      for (const col of PATCHABLE_COLS) {
        if (body[col] === undefined) continue;
        const prev = currentRow[col];
        const next = body[col];
        if (JSON.stringify(prev) === JSON.stringify(next)) continue;
        diffs.push({ field: col, previous: prev, next });
      }

      if (diffs.length === 0) {
        return {
          notFound: false as const,
          noop: true as const,
          id: currentRow.id as string,
          feature_key: currentRow.feature_key as string,
        };
      }

      await adminDb.update(features).set(setClause).where(eq(features.id, id));

      for (const d of diffs) {
        await adminDb.insert(content_edits).values({
          entity: 'features',
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
        feature_key: currentRow.feature_key as string,
        changes: diffs.length,
      };
    });

    if (result.notFound) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      feature: { id: result.id, feature_key: result.feature_key },
      changes: 'changes' in result ? result.changes : 0,
    });
  } catch (e: unknown) {
    console.error('[api/admin/membership/features PATCH]', e);
    return NextResponse.json({ error: 'Could not update feature' }, { status: 500 });
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
      // Guard: refuse if any included tier_features row references this feature
      const refs = await adminDb
        .select({ n: sql<number>`count(*)::int` })
        .from(tier_features)
        .where(and(eq(tier_features.feature_id, id), eq(tier_features.included, true)));
      if ((refs[0]?.n ?? 0) > 0) {
        return { blocked: true as const, count: refs[0].n };
      }

      const cur = await adminDb.select({ feature_key: features.feature_key }).from(features).where(eq(features.id, id)).limit(1);
      if (!cur[0]) return { notFound: true as const };

      await adminDb.delete(features).where(eq(features.id, id));

      await adminDb.insert(content_edits).values({
        entity: 'features',
        entity_id: id,
        field: '__delete__',
        editor_type: 'human',
        editor_id: user.id,
        editor_name: user.email,
        previous_value: { feature_key: cur[0].feature_key } as never,
        new_value: null,
        change_kind: 'scalar',
        reason: `Deleted feature ${cur[0].feature_key}`,
        edit_source: 'admin_ui',
      });

      return { deleted: true as const, feature_key: cur[0].feature_key };
    });

    if ('notFound' in result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ('blocked' in result) {
      return NextResponse.json(
        { error: `Cannot delete: ${result.count} tier_features row(s) reference this feature. Uncheck the matrix first.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ deleted: id });
  } catch (e) {
    console.error('[api/admin/membership/features DELETE]', e);
    return NextResponse.json({ error: 'Could not delete feature' }, { status: 500 });
  }
}
