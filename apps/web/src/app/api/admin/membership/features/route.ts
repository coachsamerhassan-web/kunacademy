/**
 * /api/admin/membership/features — Wave F.3. List + create features.
 *
 * Schema-of-truth: packages/db/src/schema/features.ts (F.1 migration 0055).
 * Columns present: feature_key, name_ar/en, description_ar/en, feature_type.
 * Spec §8.3 columns (category, icon_name, display_label_*, sort_order,
 * is_active) were NOT shipped; deferred to potential F.3.1 sub-wave.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { features, tier_features, content_edits } from '@kunacademy/db/schema';
import { eq, sql } from 'drizzle-orm';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const FEATURE_KEY_RE = /^[a-z][a-z0-9_]{1,63}$/;
const FEATURE_TYPES = new Set(['access', 'action', 'quota']);

export interface FeatureInsertBody {
  feature_key: string;
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
  description_en?: string | null;
  feature_type?: string;
}

export function validateFeatureBody(body: Partial<FeatureInsertBody>, requireAll: boolean) {
  if (requireAll || body.feature_key !== undefined) {
    if (!body.feature_key || typeof body.feature_key !== 'string' || !FEATURE_KEY_RE.test(body.feature_key)) {
      return { error: 'feature_key must be lowercase letter then [a-z0-9_]{1,63}' };
    }
  }
  if (requireAll || body.name_ar !== undefined) {
    if (!body.name_ar || typeof body.name_ar !== 'string' || body.name_ar.length > 120) {
      return { error: 'name_ar required (max 120 chars)' };
    }
  }
  if (requireAll || body.name_en !== undefined) {
    if (!body.name_en || typeof body.name_en !== 'string' || body.name_en.length > 120) {
      return { error: 'name_en required (max 120 chars)' };
    }
  }
  if (body.description_ar !== undefined && body.description_ar !== null) {
    if (typeof body.description_ar !== 'string' || body.description_ar.length > 1000) {
      return { error: 'description_ar must be string ≤1000' };
    }
  }
  if (body.description_en !== undefined && body.description_en !== null) {
    if (typeof body.description_en !== 'string' || body.description_en.length > 1000) {
      return { error: 'description_en must be string ≤1000' };
    }
  }
  if (body.feature_type !== undefined) {
    if (typeof body.feature_type !== 'string' || !FEATURE_TYPES.has(body.feature_type)) {
      return { error: 'feature_type must be access|action|quota' };
    }
  }
  return { ok: true as const };
}

export function checkOrigin(request: NextRequest): NextResponse | null {
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

// ── GET — list all features ────────────────────────────────────────────────
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await withAdminContext(async (adminDb) =>
    adminDb
      .select()
      .from(features)
      .orderBy(features.feature_key),
  );

  // Per-feature count of tier_features rows where included=true
  const countsRaw = await withAdminContext(async (adminDb) =>
    adminDb
      .select({
        feature_id: tier_features.feature_id,
        count: sql<number>`count(*)::int`,
      })
      .from(tier_features)
      .where(eq(tier_features.included, true))
      .groupBy(tier_features.feature_id),
  );
  const countMap = new Map<string, number>(
    (countsRaw as Array<{ feature_id: string; count: number }>).map((r) => [r.feature_id, r.count]),
  );
  const augmented = (rows as Array<{ id: string }>).map((r) => ({
    ...r,
    tiers_count: countMap.get(r.id) ?? 0,
  }));

  return NextResponse.json({ features: augmented });
}

// ── POST — create a new feature ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: FeatureInsertBody;
  try {
    body = (await request.json()) as FeatureInsertBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }
  const validation = validateFeatureBody(body, true);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const inserted = await withAdminContext(async (adminDb) => {
      const rows = await adminDb
        .insert(features)
        .values({
          feature_key: body.feature_key,
          name_ar: body.name_ar,
          name_en: body.name_en,
          description_ar: body.description_ar ?? null,
          description_en: body.description_en ?? null,
          feature_type: body.feature_type ?? 'access',
        })
        .returning({ id: features.id, feature_key: features.feature_key });
      const row = rows[0];

      await adminDb.insert(content_edits).values({
        entity: 'features',
        entity_id: row.id,
        field: '__create__',
        editor_type: 'human',
        editor_id: user.id,
        editor_name: user.email,
        previous_value: null,
        new_value: { feature_key: row.feature_key } as never,
        change_kind: 'scalar',
        reason: `Created feature ${row.feature_key}`,
        edit_source: 'admin_ui',
      });

      return row;
    });
    return NextResponse.json({ feature: inserted }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes('unique') || msg.includes('23505')) {
      return NextResponse.json({ error: 'A feature with this key already exists' }, { status: 409 });
    }
    console.error('[api/admin/membership/features POST]', e);
    return NextResponse.json({ error: 'Could not create feature' }, { status: 500 });
  }
}
