/**
 * /api/admin/membership/tiers — Wave F.3 admin CRUD for tiers table.
 *
 * Auth: admin | super_admin role via getAuthUser(). Unauthed → 401; non-admin → 403.
 * Writes go through withAdminContext (RLS bypass via kunacademy_admin role).
 * Every PATCH writes one content_edits row per changed field in same txn.
 *
 * Wave F.3 — Sani 2026-04-25.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { tiers, memberships, content_edits } from '@kunacademy/db/schema';
import { desc, eq, and, isNull, inArray, sql } from 'drizzle-orm';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CURRENCY_RE = /^(AED|EGP|EUR|USD)$/;

export interface TierInsertBody {
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
  description_en?: string | null;
  price_monthly_cents?: number;
  price_annual_cents?: number;
  currency?: string;
  sort_order?: number;
  is_public?: boolean;
  is_active?: boolean;
}

export function validateTierBody(body: Partial<TierInsertBody>, requireAll: boolean) {
  if (requireAll || body.slug !== undefined) {
    if (!body.slug || typeof body.slug !== 'string' || !SLUG_RE.test(body.slug)) {
      return { error: 'slug must match [a-z0-9][a-z0-9-]{0,63}' };
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
  if (body.currency !== undefined) {
    if (typeof body.currency !== 'string' || !CURRENCY_RE.test(body.currency)) {
      return { error: 'currency must be AED, EGP, EUR, or USD' };
    }
  }
  for (const field of ['price_monthly_cents', 'price_annual_cents', 'sort_order'] as const) {
    if (body[field] !== undefined) {
      if (!Number.isInteger(body[field]) || (body[field] as number) < 0) {
        return { error: `${field} must be non-negative integer` };
      }
    }
  }
  for (const field of ['is_public', 'is_active'] as const) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      return { error: `${field} must be boolean` };
    }
  }
  return { ok: true as const };
}

/**
 * CSRF check: for POST/PATCH/DELETE, if Origin header present, it must match Host.
 * Next.js fetch() sends Origin; external attackers typically do too; the check
 * blocks cross-origin POST from browser contexts.
 */
export function checkOrigin(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') return null;
  const origin = request.headers.get('origin');
  if (!origin) return null; // server-to-server; admin requireAuth gate still runs
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

// ── GET — list all tiers ────────────────────────────────────────────────────
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await withAdminContext(async (adminDb) =>
    adminDb
      .select()
      .from(tiers)
      .orderBy(tiers.sort_order, tiers.slug),
  );

  // Augment with active membership count (via subquery; cheap because 2 tiers)
  const countsRaw = await withAdminContext(async (adminDb) =>
    adminDb
      .select({
        tier_id: memberships.tier_id,
        count: sql<number>`count(*)::int`,
      })
      .from(memberships)
      .where(isNull(memberships.ended_at))
      .groupBy(memberships.tier_id),
  );
  const countMap = new Map<string, number>(
    (countsRaw as Array<{ tier_id: string; count: number }>).map((r) => [r.tier_id, r.count]),
  );
  const augmented = (rows as Array<{ id: string }>).map((r) => ({
    ...r,
    active_members: countMap.get(r.id) ?? 0,
  }));

  return NextResponse.json({ tiers: augmented });
}

// ── POST — create a new tier ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const csrf = checkOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: TierInsertBody;
  try {
    body = (await request.json()) as TierInsertBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }
  const validation = validateTierBody(body, true);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const inserted = await withAdminContext(async (adminDb) => {
      const rows = await adminDb
        .insert(tiers)
        .values({
          slug: body.slug,
          name_ar: body.name_ar,
          name_en: body.name_en,
          description_ar: body.description_ar ?? null,
          description_en: body.description_en ?? null,
          price_monthly_cents: body.price_monthly_cents ?? 0,
          price_annual_cents: body.price_annual_cents ?? 0,
          currency: body.currency ?? 'AED',
          sort_order: body.sort_order ?? 0,
          is_public: body.is_public ?? true,
          is_active: body.is_active ?? true,
        })
        .returning({ id: tiers.id, slug: tiers.slug });
      const tier = rows[0];

      // Audit: one content_edits row marking the creation event.
      await adminDb.insert(content_edits).values({
        entity: 'tiers',
        entity_id: tier.id,
        field: '__create__',
        editor_type: 'human',
        editor_id: user.id,
        editor_name: user.email,
        previous_value: null,
        new_value: { slug: tier.slug } as never,
        change_kind: 'scalar',
        reason: `Created tier ${tier.slug}`,
        edit_source: 'admin_ui',
      });

      return tier;
    });
    return NextResponse.json({ tier: inserted }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes('unique') || msg.includes('23505')) {
      return NextResponse.json({ error: 'A tier with this slug already exists' }, { status: 409 });
    }
    console.error('[api/admin/membership/tiers POST]', e);
    return NextResponse.json({ error: 'Could not create tier' }, { status: 500 });
  }
}
