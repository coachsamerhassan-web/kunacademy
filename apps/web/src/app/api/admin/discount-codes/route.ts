import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc, isNull, inArray } from 'drizzle-orm';
import { discount_codes, providers, profiles } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const CODE_REGEX = /^[A-Z0-9-]+$/;

/** GET /api/admin/discount-codes — list all discount codes with owner info */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await db
      .select()
      .from(discount_codes)
      .orderBy(desc(discount_codes.created_at)) as Array<typeof discount_codes.$inferSelect>;

    if (!rows.length) return NextResponse.json({ discount_codes: [] });

    // Resolve provider names for coach-owned codes
    const providerIds = [...new Set(rows.map((r) => r.provider_id).filter(Boolean) as string[])];

    let providerNameMap: Record<string, string> = {};
    if (providerIds.length) {
      const providerRows = await db
        .select({ id: providers.id, profile_id: providers.profile_id })
        .from(providers)
        .where(inArray(providers.id, providerIds));

      const profileIds = providerRows.map((p) => p.profile_id).filter(Boolean) as string[];
      const profileRows = profileIds.length
        ? await db
            .select({ id: profiles.id, full_name_en: profiles.full_name_en, full_name_ar: profiles.full_name_ar })
            .from(profiles)
            .where(inArray(profiles.id, profileIds))
        : [];

      const profileMap = Object.fromEntries(profileRows.map((p) => [p.id, p]));
      for (const prov of providerRows) {
        if (prov.profile_id) {
          const prof = profileMap[prov.profile_id];
          if (prof) {
            providerNameMap[prov.id] = prof.full_name_en || prof.full_name_ar || prov.id;
          }
        }
      }
    }

    const result = rows.map((r) => ({
      ...r,
      owner_name: r.provider_id ? (providerNameMap[r.provider_id] ?? r.provider_id) : null,
    }));

    return NextResponse.json({ discount_codes: result });
  } catch (err: any) {
    console.error('[api/admin/discount-codes GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/admin/discount-codes — create a new admin discount code */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      code,
      discount_type,
      discount_value,
      currency,
      valid_from,
      valid_until,
      max_uses,
      applicable_service_ids,
      is_active,
    } = body;

    // Validate required fields
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }
    const upperCode = code.toUpperCase().trim();
    if (!CODE_REGEX.test(upperCode)) {
      return NextResponse.json(
        { error: 'code must contain only uppercase letters, numbers, and hyphens' },
        { status: 400 },
      );
    }

    if (!discount_type || !['percentage', 'fixed_amount'].includes(discount_type)) {
      return NextResponse.json(
        { error: 'discount_type must be "percentage" or "fixed_amount"' },
        { status: 400 },
      );
    }

    if (discount_value === undefined || discount_value === null) {
      return NextResponse.json({ error: 'discount_value is required' }, { status: 400 });
    }
    if (discount_type === 'percentage' && (discount_value < 1 || discount_value > 100)) {
      return NextResponse.json(
        { error: 'discount_value must be between 1 and 100 for percentage type' },
        { status: 400 },
      );
    }
    if (discount_type === 'fixed_amount' && !currency) {
      return NextResponse.json(
        { error: 'currency is required for fixed_amount discount type' },
        { status: 400 },
      );
    }

    if (!valid_until) {
      return NextResponse.json({ error: 'valid_until is required' }, { status: 400 });
    }
    const fromDate = valid_from ? new Date(valid_from) : new Date();
    const untilDate = new Date(valid_until);
    if (untilDate <= fromDate) {
      return NextResponse.json(
        { error: 'valid_until must be after valid_from' },
        { status: 400 },
      );
    }

    // Check code uniqueness
    const existing = await db
      .select({ id: discount_codes.id })
      .from(discount_codes)
      .where(eq(discount_codes.code, upperCode))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    }

    const [created] = await withAdminContext(async (adminDb) => {
      return adminDb
        .insert(discount_codes)
        .values({
          code: upperCode,
          discount_type,
          discount_value: Number(discount_value),
          currency: discount_type === 'fixed_amount' ? currency : null,
          valid_from: fromDate.toISOString(),
          valid_until: untilDate.toISOString(),
          max_uses: max_uses ? Number(max_uses) : null,
          applicable_service_ids: applicable_service_ids?.length ? applicable_service_ids : null,
          provider_id: null, // admin-created codes have no provider
          is_active: is_active !== undefined ? Boolean(is_active) : true,
          current_uses: 0,
        })
        .returning();
    }) as Array<typeof discount_codes.$inferSelect>;

    return NextResponse.json({ discount_code: created }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/discount-codes POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/admin/discount-codes — update mutable fields of a discount code */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, is_active, valid_until, max_uses, applicable_service_ids } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Fetch existing to validate valid_until ordering
    const [existing] = await db
      .select({ valid_from: discount_codes.valid_from })
      .from(discount_codes)
      .where(eq(discount_codes.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    if (valid_until) {
      const untilDate = new Date(valid_until);
      const fromDate = new Date(existing.valid_from);
      if (untilDate <= fromDate) {
        return NextResponse.json(
          { error: 'valid_until must be after valid_from' },
          { status: 400 },
        );
      }
    }

    const updates: Record<string, any> = {};
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (valid_until !== undefined) updates.valid_until = new Date(valid_until).toISOString();
    if (max_uses !== undefined) updates.max_uses = max_uses ? Number(max_uses) : null;
    if (applicable_service_ids !== undefined) {
      updates.applicable_service_ids = applicable_service_ids?.length ? applicable_service_ids : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const [updated] = await withAdminContext(async (adminDb) => {
      return adminDb
        .update(discount_codes)
        .set(updates)
        .where(eq(discount_codes.id, id))
        .returning();
    }) as Array<typeof discount_codes.$inferSelect>;

    return NextResponse.json({ discount_code: updated });
  } catch (err: any) {
    console.error('[api/admin/discount-codes PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/admin/discount-codes — deactivate (soft delete) */
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

    const [deactivated] = await withAdminContext(async (adminDb) => {
      return adminDb
        .update(discount_codes)
        .set({ is_active: false })
        .where(eq(discount_codes.id, id))
        .returning({ id: discount_codes.id });
    }) as Array<{ id: string }>;

    if (!deactivated) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/discount-codes DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
