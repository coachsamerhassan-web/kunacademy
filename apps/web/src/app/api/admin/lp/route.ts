/**
 * /api/admin/lp — collection endpoints for Wave 14 LP-INFRA.
 *
 * Distinct from /api/admin/landing-pages (legacy generic landing pages with
 * sections_json/hero_json shape). This surface is for the richer LP composition
 * (composition_json + lead_capture_config + payment_config + analytics_config).
 *
 * Both endpoints write to the SAME `landing_pages` table; this admin
 * surface authoring UX targets the new columns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { desc, sql } from 'drizzle-orm';
import { landing_pages, lp_leads } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,200}$/i;

function parseJsonbField(raw: unknown, field: string): {
  ok: true;
  value: unknown | null;
} | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw === 'object') return { ok: true, value: raw };
  if (typeof raw !== 'string') {
    return { ok: false, error: `${field} must be JSON object or stringified JSON` };
  }
  const s = raw.trim();
  if (!s) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, error: `${field}: invalid JSON — ${e instanceof Error ? e.message : String(e)}` };
  }
}

export interface LpInsertBody {
  slug: string;
  page_type?: string;
  published?: boolean;
  launch_lock?: boolean;
  composition_json?: unknown;
  lead_capture_config?: unknown;
  payment_config?: unknown;
  analytics_config?: unknown;
  seo_meta_json?: unknown;
  hero_json?: unknown;
  sections_json?: unknown;
  program_slug?: string | null;
}

export function validateLpBody(body: LpInsertBody, requireSlug = true) {
  if (requireSlug) {
    if (!body.slug || typeof body.slug !== 'string') {
      return { error: 'slug is required' as const };
    }
    if (!SLUG_RE.test(body.slug)) {
      return { error: 'slug must match [a-z0-9][a-z0-9-]{0,200}' as const };
    }
  }

  const composition = parseJsonbField(body.composition_json, 'composition_json');
  if ('error' in composition) return { error: composition.error };

  const lead = parseJsonbField(body.lead_capture_config, 'lead_capture_config');
  if ('error' in lead) return { error: lead.error };

  const payment = parseJsonbField(body.payment_config, 'payment_config');
  if ('error' in payment) return { error: payment.error };

  const analytics = parseJsonbField(body.analytics_config, 'analytics_config');
  if ('error' in analytics) return { error: analytics.error };

  const seo = parseJsonbField(body.seo_meta_json, 'seo_meta_json');
  if ('error' in seo) return { error: seo.error };

  return {
    composition: composition.value,
    lead: lead.value,
    payment: payment.value,
    analytics: analytics.value,
    seo: seo.value,
  };
}

// ── GET — list all LPs (with lead counts) ───────────────────────────────────
export async function GET() {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Single query with subquery for lead counts
  const rows = await db
    .select({
      id: landing_pages.id,
      slug: landing_pages.slug,
      page_type: landing_pages.page_type,
      published: landing_pages.published,
      launch_lock: landing_pages.launch_lock,
      composition_json: landing_pages.composition_json,
      lead_capture_config: landing_pages.lead_capture_config,
      payment_config: landing_pages.payment_config,
      analytics_config: landing_pages.analytics_config,
      seo_meta_json: landing_pages.seo_meta_json,
      created_at: landing_pages.created_at,
      updated_at: landing_pages.updated_at,
      lead_count: sql<number>`(SELECT count(*)::int FROM ${lp_leads} WHERE ${lp_leads.landing_page_id} = ${landing_pages.id})`,
    })
    .from(landing_pages)
    .orderBy(desc(landing_pages.updated_at));

  return NextResponse.json({ landing_pages: rows });
}

// ── POST — create a new LP row ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as LpInsertBody;
  const validated = validateLpBody(body, true);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const [inserted] = await db
      .insert(landing_pages)
      .values({
        slug: body.slug,
        page_type: body.page_type || 'landing',
        published: body.published ?? false,
        launch_lock: body.launch_lock ?? false,
        composition_json: validated.composition ?? undefined,
        lead_capture_config: validated.lead ?? undefined,
        payment_config: validated.payment ?? undefined,
        analytics_config: validated.analytics ?? undefined,
        seo_meta_json: (validated.seo ?? {}) as Record<string, unknown>,
        hero_json: {} as Record<string, unknown>,
        sections_json: {} as Record<string, unknown>,
        program_slug: body.program_slug ?? null,
        last_edited_by: user.id,
        last_edited_at: new Date().toISOString(),
      })
      .returning({ id: landing_pages.id, slug: landing_pages.slug });
    return NextResponse.json({ landing_page: inserted }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes('unique') || msg.includes('23505')) {
      return NextResponse.json({ error: 'A landing page with this slug already exists' }, { status: 409 });
    }
    console.error('[api/admin/lp POST]', e);
    return NextResponse.json({ error: 'Could not create landing page' }, { status: 500 });
  }
}
