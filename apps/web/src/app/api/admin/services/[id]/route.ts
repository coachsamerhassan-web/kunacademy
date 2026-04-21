/**
 * /api/admin/services/[id]
 *
 * Single-item read + full-field update + delete for the admin service editor.
 * Phase 2a (2026-04-21, CMS→DB) — introduces this endpoint alongside the existing
 * collection-level POST/PUT/DELETE. The `[id]` shape matches the Phase 1c
 * testimonials pattern and is what the /admin/services/[id] form page calls.
 *
 * The bulk-update semantics (PUT on /api/admin/services with body.id) remain
 * intact for backward compat with any existing callers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { services, bookings, service_categories } from '@kunacademy/db/schema';
import { validatePhase2aFields, coercePhase2aFields } from '../route';
import { KUN_LEVELS } from '@kunacademy/db/enums';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const VALID_COACH_CONTROLS = ['optional', 'mandatory', 'admin_only'] as const;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;

    const rows = await db
      .select({
        id: services.id,
        slug: services.slug,
        name_ar: services.name_ar,
        name_en: services.name_en,
        description_ar: services.description_ar,
        description_en: services.description_en,
        duration_minutes: services.duration_minutes,
        price_aed: services.price_aed,
        price_egp: services.price_egp,
        price_usd: services.price_usd,
        price_eur: services.price_eur,
        price_sar: services.price_sar,
        is_active: services.is_active,
        category_id: services.category_id,
        sessions_count: services.sessions_count,
        validity_days: services.validity_days,
        eligible_kun_levels: services.eligible_kun_levels,
        coach_control: services.coach_control,
        allows_coach_pricing: services.allows_coach_pricing,
        min_price_aed: services.min_price_aed,
        min_price_egp: services.min_price_egp,
        min_price_eur: services.min_price_eur,
        bundle_id: services.bundle_id,
        discount_percentage: services.discount_percentage,
        discount_valid_until: services.discount_valid_until,
        installment_enabled: services.installment_enabled,
        coach_level_min: services.coach_level_min,
        coach_level_exact: services.coach_level_exact,
        icf_credential_target: services.icf_credential_target,
        coach_slug: services.coach_slug,
        display_order: services.display_order,
        is_free: services.is_free,
        student_only: services.student_only,
        program_slug: services.program_slug,
        published: services.published,
        last_edited_by: services.last_edited_by,
        last_edited_at: services.last_edited_at,
      })
      .from(services)
      .where(eq(services.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Also return all service_categories for the editor's category dropdown
    const categories = await db
      .select({
        id: service_categories.id,
        slug: service_categories.slug,
        name_ar: service_categories.name_ar,
        name_en: service_categories.name_en,
      })
      .from(service_categories);

    return NextResponse.json({ service: row, categories });
  } catch (err: any) {
    console.error('[api/admin/services/[id] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json();

    // Guard required fields when provided
    if (body.name_ar !== undefined && !body.name_ar) {
      return NextResponse.json({ error: 'name_ar is required' }, { status: 400 });
    }
    if (body.name_en !== undefined && !body.name_en) {
      return NextResponse.json({ error: 'name_en is required' }, { status: 400 });
    }
    if (body.duration_minutes !== undefined && Number(body.duration_minutes) <= 0) {
      return NextResponse.json({ error: 'duration_minutes must be greater than 0' }, { status: 400 });
    }
    if (body.coach_control && !VALID_COACH_CONTROLS.includes(body.coach_control)) {
      return NextResponse.json({ error: `coach_control must be one of: ${VALID_COACH_CONTROLS.join(', ')}` }, { status: 400 });
    }

    // Slug uniqueness
    if (body.slug) {
      const existing = await db
        .select({ id: services.id })
        .from(services)
        .where(eq(services.slug, body.slug))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json({ error: 'Slug already in use by another service' }, { status: 409 });
      }
    }

    const phase2aErr = validatePhase2aFields(body);
    if (phase2aErr) return NextResponse.json({ error: phase2aErr }, { status: 400 });

    const updates: Record<string, any> = {};
    const baseFields = [
      'slug', 'name_ar', 'name_en', 'description_ar', 'description_en',
      'duration_minutes', 'price_aed', 'price_egp', 'price_usd', 'price_sar',
      'is_active', 'category_id', 'sessions_count', 'validity_days',
      'coach_control', 'allows_coach_pricing',
      'min_price_aed', 'min_price_egp', 'min_price_eur',
    ] as const;
    const intFields = new Set([
      'duration_minutes', 'price_aed', 'price_egp', 'price_usd', 'price_sar',
      'min_price_aed', 'min_price_egp', 'min_price_eur', 'sessions_count', 'validity_days',
    ]);
    for (const f of baseFields) {
      if (body[f] !== undefined) {
        if (intFields.has(f)) {
          updates[f] = body[f] === null || body[f] === '' ? null : Number(body[f]);
        } else if (typeof body[f] === 'string' && body[f] === '') {
          updates[f] = null;
        } else {
          updates[f] = body[f];
        }
      }
    }
    if (body.eligible_kun_levels !== undefined) {
      const levels = Array.isArray(body.eligible_kun_levels)
        ? body.eligible_kun_levels.filter((l: string) => (KUN_LEVELS as readonly string[]).includes(l))
        : null;
      updates.eligible_kun_levels = levels && levels.length > 0 ? levels : null;
    }
    Object.assign(updates, coercePhase2aFields(body));

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.last_edited_by = user.id;
    updates.last_edited_at = new Date();

    const [row] = await withAdminContext(async (adminDb) =>
      adminDb.update(services).set(updates).where(eq(services.id, id)).returning()
    );

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ service: row });
  } catch (err: any) {
    console.error('[api/admin/services/[id] PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;

    // Mirror collection DELETE semantics: soft-delete when bookings reference the service.
    const referenced = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.service_id, id))
      .limit(1);

    if (referenced.length > 0) {
      await withAdminContext(async (adminDb) => {
        await adminDb
          .update(services)
          .set({ is_active: false, published: false, last_edited_by: user.id, last_edited_at: new Date() })
          .where(eq(services.id, id));
      });
      return NextResponse.json({ success: true, deactivated: true, deleted: false });
    }

    const deleted = await withAdminContext(async (adminDb) =>
      adminDb.delete(services).where(eq(services.id, id)).returning({ id: services.id })
    );
    if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, deactivated: false, deleted: true });
  } catch (err: any) {
    console.error('[api/admin/services/[id] DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
