/**
 * /api/admin/membership/tier-features — Wave F.3 batch matrix endpoint.
 *
 * GET  → returns all rows from tier_features (entire matrix) + the source
 *        tables so the client can render rows × columns without separate
 *        round-trips.
 * POST → batch upsert. Body: { ops: [{ tier_id, feature_id, included, quota?, config? }] }
 *        For each op: UPSERT tier_features row (cascade: included=false
 *        with no quota is semantically "off" — we keep the row but flip the
 *        flag, preserving config jsonb for later re-enable).
 *
 * Same-transaction audit: one content_edits row per op that changes state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { tier_features, tiers, features, content_edits } from '@kunacademy/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { checkOrigin } from '../tiers/route';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MatrixOp {
  tier_id: string;
  feature_id: string;
  included: boolean;
  quota?: number | null;
  config?: Record<string, unknown> | null;
}

function validateOp(op: unknown): { error: string } | { ok: MatrixOp } {
  if (!op || typeof op !== 'object') return { error: 'op must be object' };
  const o = op as Record<string, unknown>;
  if (typeof o.tier_id !== 'string' || !UUID_RE.test(o.tier_id)) {
    return { error: 'tier_id must be a UUID' };
  }
  if (typeof o.feature_id !== 'string' || !UUID_RE.test(o.feature_id)) {
    return { error: 'feature_id must be a UUID' };
  }
  if (typeof o.included !== 'boolean') return { error: 'included must be boolean' };
  let quota: number | null = null;
  if (o.quota !== undefined && o.quota !== null) {
    if (!Number.isInteger(o.quota) || (o.quota as number) < 0) {
      return { error: 'quota must be non-negative integer or null' };
    }
    quota = o.quota as number;
  }
  let config: Record<string, unknown> | null = null;
  if (o.config !== undefined && o.config !== null) {
    if (typeof o.config !== 'object' || Array.isArray(o.config)) {
      return { error: 'config must be object or null' };
    }
    const serialized = JSON.stringify(o.config);
    if (serialized.length > 20_000) return { error: 'config too large (>20KB)' };
    config = o.config as Record<string, unknown>;
  }
  return {
    ok: {
      tier_id: o.tier_id,
      feature_id: o.feature_id,
      included: o.included,
      quota,
      config,
    },
  };
}

// ── GET — full matrix snapshot ──────────────────────────────────────────────
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { tiersRows, featuresRows, matrixRows } = await withAdminContext(async (adminDb) => {
    const tiersRows = await adminDb.select().from(tiers).orderBy(tiers.sort_order, tiers.slug);
    const featuresRows = await adminDb.select().from(features).orderBy(features.feature_key);
    const matrixRows = await adminDb.select().from(tier_features);
    return { tiersRows, featuresRows, matrixRows };
  });

  return NextResponse.json({
    tiers: tiersRows,
    features: featuresRows,
    matrix: matrixRows,
  });
}

// ── POST — batch upsert ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { ops?: unknown[] };
  try {
    body = (await request.json()) as { ops?: unknown[] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !Array.isArray(body.ops)) {
    return NextResponse.json({ error: 'Body must be { ops: [...] }' }, { status: 400 });
  }
  if (body.ops.length > 500) {
    return NextResponse.json({ error: 'Too many ops (>500)' }, { status: 413 });
  }

  const validated: MatrixOp[] = [];
  for (const raw of body.ops) {
    const v = validateOp(raw);
    if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
    validated.push(v.ok);
  }

  try {
    const changes = await withAdminContext(async (adminDb) => {
      let applied = 0;
      for (const op of validated) {
        // Load current row (if any) to diff
        const existing = await adminDb
          .select()
          .from(tier_features)
          .where(
            and(
              eq(tier_features.tier_id, op.tier_id),
              eq(tier_features.feature_id, op.feature_id),
            ),
          )
          .limit(1);
        const prev = existing[0] ?? null;

        const prevState = prev
          ? { included: prev.included, quota: prev.quota, config: prev.config }
          : { included: false, quota: null, config: null };
        const nextState = { included: op.included, quota: op.quota, config: op.config };

        // Compute whether this op is a no-op
        const isNoop =
          prevState.included === nextState.included &&
          (prevState.quota ?? null) === (nextState.quota ?? null) &&
          JSON.stringify(prevState.config ?? null) === JSON.stringify(nextState.config ?? null);

        if (isNoop) continue;

        if (prev) {
          await adminDb
            .update(tier_features)
            .set({
              included: op.included,
              quota: op.quota,
              config: op.config as never,
            })
            .where(
              and(
                eq(tier_features.tier_id, op.tier_id),
                eq(tier_features.feature_id, op.feature_id),
              ),
            );
        } else if (op.included || op.quota !== null || op.config !== null) {
          // Only INSERT if there's something non-trivial to persist
          await adminDb.insert(tier_features).values({
            tier_id: op.tier_id,
            feature_id: op.feature_id,
            included: op.included,
            quota: op.quota,
            config: op.config as never,
          });
        } else {
          // No row and all-default op → nothing to record
          continue;
        }

        await adminDb.insert(content_edits).values({
          entity: 'tier_features',
          // entity_id is the tier_id; the feature_id is included in the reason
          // string for traceability. No UUID fits a composite-PK audit cleanly;
          // we use tier_id because that's the admin-facing "what changed".
          entity_id: op.tier_id,
          field: `feature:${op.feature_id}`,
          editor_type: 'human',
          editor_id: user.id,
          editor_name: user.email,
          previous_value: prevState as never,
          new_value: nextState as never,
          change_kind: 'scalar',
          reason: `Matrix toggle tier=${op.tier_id} feature=${op.feature_id}`,
          edit_source: 'admin_ui',
        });
        applied++;
      }
      return applied;
    });

    return NextResponse.json({ changes, total_ops: validated.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('foreign key') || msg.includes('23503')) {
      return NextResponse.json({ error: 'tier_id or feature_id references non-existent row' }, { status: 400 });
    }
    // DeepSeek F.3 LOW-#1: concurrent batch inserts of same (tier_id,feature_id)
    // race on the primary key — surface as 409 instead of generic 500.
    if (msg.toLowerCase().includes('unique') || msg.includes('23505') ||
        msg.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'Concurrent matrix update collision. Reload and retry.' },
        { status: 409 },
      );
    }
    console.error('[api/admin/membership/tier-features POST]', e);
    return NextResponse.json({ error: 'Could not apply matrix changes' }, { status: 500 });
  }
}
