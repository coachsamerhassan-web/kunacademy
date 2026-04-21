import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc, inArray } from 'drizzle-orm';
import { services, service_categories, bookings } from '@kunacademy/db/schema';
import { KUN_LEVELS } from '@kunacademy/db/enums';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const VALID_COACH_CONTROLS = ['optional', 'mandatory', 'admin_only'] as const;
const VALID_KUN_LEVELS = KUN_LEVELS;
const VALID_ICF_CREDENTIALS = ['ACC', 'PCC', 'MCC'] as const;
const VALID_COACH_LEVELS = ['basic', 'professional', 'expert', 'master'] as const;

/**
 * Phase 2a (2026-04-21): additional CMS columns added to services.
 * Exported so the `/[id]` route can share validation + field allowlists.
 */
export const PHASE2A_FIELDS = [
  'bundle_id',
  'discount_percentage',
  'discount_valid_until',
  'installment_enabled',
  'coach_level_min',
  'coach_level_exact',
  'icf_credential_target',
  'coach_slug',
  'display_order',
  'is_free',
  'student_only',
  'program_slug',
  'published',
  'price_eur',
] as const;

/** Return null on validation success; an error string otherwise. */
export function validatePhase2aFields(fields: Record<string, unknown>): string | null {
  if (
    fields.discount_percentage !== undefined &&
    fields.discount_percentage !== null
  ) {
    const n = Number(fields.discount_percentage);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return 'discount_percentage must be between 0 and 100';
    }
  }
  if (
    fields.icf_credential_target !== undefined &&
    fields.icf_credential_target !== null &&
    fields.icf_credential_target !== '' &&
    !VALID_ICF_CREDENTIALS.includes(fields.icf_credential_target as typeof VALID_ICF_CREDENTIALS[number])
  ) {
    return `icf_credential_target must be one of: ${VALID_ICF_CREDENTIALS.join(', ')}`;
  }
  for (const k of ['coach_level_min', 'coach_level_exact'] as const) {
    const v = fields[k];
    if (v !== undefined && v !== null && v !== '' &&
      !VALID_COACH_LEVELS.includes(v as typeof VALID_COACH_LEVELS[number])) {
      return `${k} must be one of: ${VALID_COACH_LEVELS.join(', ')}`;
    }
  }
  if (fields.display_order !== undefined && fields.display_order !== null && fields.display_order !== '') {
    const n = Number(fields.display_order);
    if (!Number.isInteger(n)) return 'display_order must be an integer';
  }
  if (fields.discount_valid_until !== undefined && fields.discount_valid_until !== null && fields.discount_valid_until !== '') {
    // Expect ISO date (YYYY-MM-DD). Permissive — Postgres will reject invalid values anyway.
    if (typeof fields.discount_valid_until !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fields.discount_valid_until)) {
      return 'discount_valid_until must be ISO date (YYYY-MM-DD)';
    }
  }
  return null;
}

/** Coerce + nullify the Phase 2a fields into a partial update set. */
export function coercePhase2aFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const str = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v));
  const bool = (v: unknown) => Boolean(v);
  const intOrNull = (v: unknown) =>
    v === undefined || v === null || v === '' ? null : Number(v);

  if ('bundle_id' in fields) out.bundle_id = str(fields.bundle_id);
  if ('discount_percentage' in fields) out.discount_percentage = intOrNull(fields.discount_percentage);
  if ('discount_valid_until' in fields) out.discount_valid_until = str(fields.discount_valid_until);
  if ('installment_enabled' in fields) out.installment_enabled = bool(fields.installment_enabled);
  if ('coach_level_min' in fields) out.coach_level_min = str(fields.coach_level_min);
  if ('coach_level_exact' in fields) out.coach_level_exact = str(fields.coach_level_exact);
  if ('icf_credential_target' in fields) out.icf_credential_target = str(fields.icf_credential_target);
  if ('coach_slug' in fields) out.coach_slug = str(fields.coach_slug);
  if ('display_order' in fields) {
    const n = intOrNull(fields.display_order);
    out.display_order = n === null ? 0 : n;
  }
  if ('is_free' in fields) out.is_free = bool(fields.is_free);
  if ('student_only' in fields) out.student_only = bool(fields.student_only);
  if ('program_slug' in fields) out.program_slug = str(fields.program_slug);
  if ('published' in fields) out.published = bool(fields.published);
  if ('price_eur' in fields) out.price_eur = intOrNull(fields.price_eur) ?? 0;
  return out;
}

/**
 * GET /api/admin/services
 * Returns all services (active + inactive) with category data, sorted by category then name.
 * Also returns all service_categories for use in the Add/Edit modal dropdown.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [serviceRows, categoryRows] = await Promise.all([
      db
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
          // Phase 2a (CMS→DB) extension columns
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
          last_edited_at: services.last_edited_at,
        })
        .from(services)
        .orderBy(asc(services.display_order), asc(services.category_id), asc(services.name_en)),
      db
        .select({
          id: service_categories.id,
          slug: service_categories.slug,
          name_ar: service_categories.name_ar,
          name_en: service_categories.name_en,
          display_order: service_categories.display_order,
        })
        .from(service_categories)
        .orderBy(asc(service_categories.display_order)),
    ]);

    // Enrich services with category name
    const categoryMap = Object.fromEntries(categoryRows.map((c) => [c.id, c]));
    const result = serviceRows.map((s) => ({
      ...s,
      category: s.category_id ? (categoryMap[s.category_id] ?? null) : null,
    }));

    return NextResponse.json({ services: result, categories: categoryRows });
  } catch (err: any) {
    console.error('[api/admin/services GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/services
 * Create a new service.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      slug,
      name_ar,
      name_en,
      description_ar,
      description_en,
      duration_minutes,
      price_aed,
      price_egp,
      price_usd,
      price_sar,
      is_active,
      category_id,
      sessions_count,
      validity_days,
      eligible_kun_levels,
      coach_control,
      allows_coach_pricing,
      min_price_aed,
      min_price_egp,
      min_price_eur,
    } = body;

    // Required field validation
    if (!name_ar || !name_en) {
      return NextResponse.json({ error: 'name_ar and name_en are required' }, { status: 400 });
    }
    if (!duration_minutes || Number(duration_minutes) <= 0) {
      return NextResponse.json({ error: 'duration_minutes must be greater than 0' }, { status: 400 });
    }
    if (coach_control && !VALID_COACH_CONTROLS.includes(coach_control)) {
      return NextResponse.json({ error: `coach_control must be one of: ${VALID_COACH_CONTROLS.join(', ')}` }, { status: 400 });
    }
    // Phase 2a field validation
    const phase2aErr = validatePhase2aFields(body);
    if (phase2aErr) {
      return NextResponse.json({ error: phase2aErr }, { status: 400 });
    }

    // Slug uniqueness check
    if (slug) {
      const existing = await db
        .select({ id: services.id })
        .from(services)
        .where(eq(services.slug, slug))
        .limit(1);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      }
    }

    // Sanitize eligible_kun_levels
    const sanitizedLevels = Array.isArray(eligible_kun_levels)
      ? eligible_kun_levels.filter((l: string) => VALID_KUN_LEVELS.includes(l as any))
      : null;

    const phase2aValues = coercePhase2aFields(body);

    const inserted = await withAdminContext(async (adminDb) =>
      adminDb
        .insert(services)
        .values({
          slug: slug || null,
          name_ar,
          name_en,
          description_ar: description_ar || null,
          description_en: description_en || null,
          duration_minutes: Number(duration_minutes),
          price_aed: price_aed !== undefined ? Number(price_aed) : 0,
          price_egp: price_egp !== undefined ? Number(price_egp) : 0,
          price_usd: price_usd !== undefined ? Number(price_usd) : 0,
          price_sar: price_sar !== undefined ? Number(price_sar) : 0,
          is_active: is_active !== undefined ? Boolean(is_active) : true,
          category_id: category_id || null,
          sessions_count: sessions_count ? Number(sessions_count) : null,
          validity_days: validity_days ? Number(validity_days) : null,
          eligible_kun_levels: sanitizedLevels && sanitizedLevels.length > 0 ? sanitizedLevels : null,
          coach_control: coach_control || 'mandatory',
          allows_coach_pricing: Boolean(allows_coach_pricing),
          min_price_aed: min_price_aed ? Number(min_price_aed) : 0,
          min_price_egp: min_price_egp ? Number(min_price_egp) : 0,
          min_price_eur: min_price_eur ? Number(min_price_eur) : 0,
          // Phase 2a — spread coerced values (all optional; defaults come from DB)
          ...(phase2aValues as Record<string, never>),
          // Audit
          last_edited_by: user.id,
          last_edited_at: new Date(),
        })
        .returning()
    );

    return NextResponse.json({ service: inserted[0] }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/services POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/services
 * Partial update of an existing service.
 * Body: { id, ...fields }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Validate coach_control if provided
    if (fields.coach_control && !VALID_COACH_CONTROLS.includes(fields.coach_control)) {
      return NextResponse.json({ error: `coach_control must be one of: ${VALID_COACH_CONTROLS.join(', ')}` }, { status: 400 });
    }

    // Validate duration_minutes if provided
    if (fields.duration_minutes !== undefined && Number(fields.duration_minutes) <= 0) {
      return NextResponse.json({ error: 'duration_minutes must be greater than 0' }, { status: 400 });
    }

    // Slug uniqueness check (only if slug is being changed)
    if (fields.slug) {
      const existing = await db
        .select({ id: services.id })
        .from(services)
        .where(eq(services.slug, fields.slug))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json({ error: 'Slug already in use by another service' }, { status: 409 });
      }
    }

    // Phase 2a field validation
    const phase2aErr = validatePhase2aFields(fields);
    if (phase2aErr) {
      return NextResponse.json({ error: phase2aErr }, { status: 400 });
    }

    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    const allowedFields = [
      'slug', 'name_ar', 'name_en', 'description_ar', 'description_en',
      'duration_minutes', 'price_aed', 'price_egp', 'price_usd', 'price_sar',
      'is_active', 'category_id', 'sessions_count', 'validity_days',
      'eligible_kun_levels', 'coach_control', 'allows_coach_pricing',
      'min_price_aed', 'min_price_egp', 'min_price_eur',
    ];

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        if (['price_aed', 'price_egp', 'price_usd', 'price_sar', 'min_price_aed', 'min_price_egp', 'min_price_eur', 'duration_minutes', 'sessions_count', 'validity_days'].includes(field)) {
          updates[field] = fields[field] !== null ? Number(fields[field]) : null;
        } else if (field === 'eligible_kun_levels') {
          const levels = Array.isArray(fields[field])
            ? fields[field].filter((l: string) => VALID_KUN_LEVELS.includes(l as any))
            : null;
          updates[field] = levels && levels.length > 0 ? levels : null;
        } else {
          updates[field] = fields[field];
        }
      }
    }

    // Merge Phase 2a fields (coerced)
    Object.assign(updates, coercePhase2aFields(fields));

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Audit
    updates.last_edited_by = user.id;
    updates.last_edited_at = new Date();

    await withAdminContext(async (adminDb) => {
      await adminDb.update(services).set(updates).where(eq(services.id, id));
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/services PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/services
 * Soft delete (set is_active = false) if any bookings reference this service.
 * Hard delete if no bookings reference it.
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Check if any bookings reference this service
    const referencedBookings = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.service_id, id))
      .limit(1);

    const hasBookings = referencedBookings.length > 0;

    if (hasBookings) {
      // Soft delete — preserve record for booking history
      await withAdminContext(async (adminDb) => {
        await adminDb.update(services).set({ is_active: false }).where(eq(services.id, id));
      });
      return NextResponse.json({ success: true, deleted: false, deactivated: true });
    }

    // Hard delete — no bookings reference this service
    await withAdminContext(async (adminDb) => {
      await adminDb.delete(services).where(eq(services.id, id));
    });

    return NextResponse.json({ success: true, deleted: true, deactivated: false });
  } catch (err: any) {
    console.error('[api/admin/services DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
