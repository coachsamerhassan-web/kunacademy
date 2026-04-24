import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc } from 'drizzle-orm';
import { landing_pages, lp_leads } from '@kunacademy/db/schema';
import { validateLpBody, type LpInsertBody } from '../route';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'content_editor';
}

// ── GET /[id] — fetch one LP + its recent leads ─────────────────────────────
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // Use withAdminContext so RLS lets us read drafts (published=false).
  // The `kunacademy` app role hits the `landing_pages_published_read` policy
  // and only sees published=true rows; admin context bypasses that.
  const { row, recentLeads } = await withAdminContext(async (adminDb) => {
    const rows = await adminDb
      .select()
      .from(landing_pages)
      .where(eq(landing_pages.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return { row: null, recentLeads: [] as Array<Record<string, unknown>> };

    const recentLeads = await adminDb
      .select({
        id: lp_leads.id,
        name: lp_leads.name,
        email: lp_leads.email,
        phone: lp_leads.phone,
        message: lp_leads.message,
        locale: lp_leads.locale,
        utm_source: lp_leads.utm_source,
        utm_campaign: lp_leads.utm_campaign,
        zoho_synced: lp_leads.zoho_synced,
        created_at: lp_leads.created_at,
      })
      .from(lp_leads)
      .where(eq(lp_leads.landing_page_id, id))
      .orderBy(desc(lp_leads.created_at))
      .limit(50);
    return { row, recentLeads };
  });

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ landing_page: row, recent_leads: recentLeads });
}

// ── PATCH /[id] — full-field update ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<LpInsertBody>;
  const validated = validateLpBody(body as LpInsertBody, false);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    last_edited_by: user.id,
    last_edited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (typeof body.published === 'boolean') updates.published = body.published;
  if (typeof body.launch_lock === 'boolean') updates.launch_lock = body.launch_lock;
  if (typeof body.page_type === 'string') updates.page_type = body.page_type;
  if (body.slug && /^[a-z0-9][a-z0-9-]{0,200}$/i.test(body.slug)) updates.slug = body.slug;
  if ('composition_json' in body) updates.composition_json = validated.composition;
  if ('lead_capture_config' in body) updates.lead_capture_config = validated.lead;
  if ('payment_config' in body) updates.payment_config = validated.payment;
  if ('analytics_config' in body) updates.analytics_config = validated.analytics;
  if ('seo_meta_json' in body) updates.seo_meta_json = validated.seo ?? {};
  if ('program_slug' in body) updates.program_slug = body.program_slug ?? null;

  try {
    const updated = await withAdminContext(async (adminDb) => {
      const rows = await adminDb
        .update(landing_pages)
        .set(updates)
        .where(eq(landing_pages.id, id))
        .returning({ id: landing_pages.id, slug: landing_pages.slug });
      return rows[0];
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ landing_page: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes('unique') || msg.includes('23505')) {
      return NextResponse.json({ error: 'A landing page with this slug already exists' }, { status: 409 });
    }
    console.error('[api/admin/lp PATCH]', e);
    return NextResponse.json({ error: 'Could not update landing page' }, { status: 500 });
  }
}

// ── DELETE /[id] — remove LP (cascades to lp_leads via FK ON DELETE CASCADE) ─
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const deleted = await withAdminContext(async (adminDb) => {
      const rows = await adminDb
        .delete(landing_pages)
        .where(eq(landing_pages.id, id))
        .returning({ id: landing_pages.id });
      return rows[0];
    });
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ deleted: deleted.id });
  } catch (e) {
    console.error('[api/admin/lp DELETE]', e);
    return NextResponse.json({ error: 'Could not delete landing page' }, { status: 500 });
  }
}
