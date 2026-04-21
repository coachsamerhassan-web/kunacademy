/**
 * /api/admin/programs/[slug]/overrides — collection endpoints
 *
 * Region-level price overrides for service-type programs (2026-04-21).
 *
 * GET  — list all overrides for the given program slug (admin-only).
 * POST — create a new override for the program slug.
 *
 * Single-item operations (PATCH, DELETE) live in ./[id]/route.ts.
 *
 * Four-role safety:
 *   - Admin: full CRUD via these routes.
 *   - Coach / Student / unauthenticated: reads only via the public CMS path
 *     (getProgram(slug, region)) — they never hit this admin API.
 *   - Attacker: 403 on all methods if not admin; POST body validation prevents
 *     injection; withAdminContext enforces BYPASSRLS for writes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { programs, programPriceOverrides } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const VALID_CURRENCIES = ['AED', 'EGP', 'SAR', 'USD', 'EUR'] as const;
type ValidCurrency = (typeof VALID_CURRENCIES)[number];

interface OverrideBody {
  region?: unknown;
  price?: unknown;
  currency?: unknown;
  notes?: unknown;
}

function validateOverrideBody(
  body: OverrideBody,
  opts: { partial?: boolean } = {},
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const out: Record<string, unknown> = {};
  const partial = Boolean(opts.partial);

  // region
  if (!partial || body.region !== undefined) {
    if (typeof body.region !== 'string' || body.region.trim().length < 2) {
      return { ok: false, error: 'region must be a non-empty string (min 2 chars, e.g. "AE", "EG", "SA", "OTHER")' };
    }
    out.region = body.region.trim().toUpperCase();
  }

  // price
  if (!partial || body.price !== undefined) {
    const p = typeof body.price === 'number' ? body.price : Number(body.price);
    if (!Number.isFinite(p) || p < 0) {
      return { ok: false, error: 'price must be a non-negative number' };
    }
    // Store as string (numeric DB column accepts string)
    out.price = p.toFixed(2);
  }

  // currency
  if (!partial || body.currency !== undefined) {
    const c = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
    if (!VALID_CURRENCIES.includes(c as ValidCurrency)) {
      return { ok: false, error: `currency must be one of: ${VALID_CURRENCIES.join(', ')}` };
    }
    out.currency = c;
  }

  // notes (optional)
  if (body.notes !== undefined) {
    if (body.notes === null || body.notes === '') {
      out.notes = null;
    } else if (typeof body.notes === 'string') {
      out.notes = body.notes.trim() || null;
    } else {
      return { ok: false, error: 'notes must be a string or null' };
    }
  }

  return { ok: true, value: out };
}

export { validateOverrideBody };

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Dynamic segment renamed [slug] → [id] (2026-04-21) to avoid clash with
    // sibling [id] route; the value is still a program slug, not a UUID.
    const { id: slug } = await context.params;

    // Verify program exists
    const progRows = await db
      .select({ slug: programs.slug, title_en: programs.title_en })
      .from(programs)
      .where(eq(programs.slug, slug))
      .limit(1);
    if (progRows.length === 0) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const overrides = await db
      .select()
      .from(programPriceOverrides)
      .where(eq(programPriceOverrides.program_slug, slug))
      .orderBy(asc(programPriceOverrides.region));

    return NextResponse.json({ overrides, program: progRows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/programs/[slug]/overrides GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Dynamic segment renamed [slug] → [id] (2026-04-21) to avoid clash with
    // sibling [id] route; the value is still a program slug, not a UUID.
    const { id: slug } = await context.params;

    // Verify program exists
    const progRows = await db
      .select({ slug: programs.slug })
      .from(programs)
      .where(eq(programs.slug, slug))
      .limit(1);
    if (progRows.length === 0) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const body = await request.json() as OverrideBody;
    const parsed = validateOverrideBody(body, { partial: false });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const inserted = await withAdminContext(async (adminDb) =>
      adminDb
        .insert(programPriceOverrides)
        .values({
          program_slug: slug,
          region: parsed.value.region as string,
          price: parsed.value.price as string,
          currency: parsed.value.currency as string,
          notes: (parsed.value.notes as string | null) ?? null,
        })
        .returning(),
    );

    return NextResponse.json({ override: inserted[0] }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Postgres unique violation (23505): slug+region already exists
    if (msg.includes('23505') || msg.includes('program_price_overrides_slug_region_uq')) {
      return NextResponse.json(
        { error: 'An override already exists for this program+region combination' },
        { status: 409 },
      );
    }
    console.error('[api/admin/programs/[slug]/overrides POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
