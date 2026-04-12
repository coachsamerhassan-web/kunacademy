import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and, desc } from 'drizzle-orm';
import { discount_codes, providers, instructors } from '@kunacademy/db/schema';

const CODE_REGEX = /^[A-Z0-9-]+$/;

/** Resolve provider_id for the authenticated coach */
async function resolveProviderId(userId: string): Promise<string | null> {
  const instructorRows = await db
    .select({ id: instructors.id })
    .from(instructors)
    .where(eq(instructors.profile_id, userId))
    .limit(1);

  if (!instructorRows[0]) return null;

  const providerRows = await db
    .select({ id: providers.id })
    .from(providers)
    .where(eq(providers.profile_id, userId))
    .limit(1);

  return providerRows[0]?.id ?? null;
}

/**
 * GET /api/coach/discount-codes
 * Returns all discount codes belonging to this coach.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const provider_id = await resolveProviderId(user.id);
    if (!provider_id) return NextResponse.json({ discount_codes: [], provider_id: null });

    const rows = await db
      .select()
      .from(discount_codes)
      .where(eq(discount_codes.provider_id, provider_id))
      .orderBy(desc(discount_codes.created_at)) as Array<typeof discount_codes.$inferSelect>;

    return NextResponse.json({ discount_codes: rows, provider_id });
  } catch (err: any) {
    console.error('[api/coach/discount-codes GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/coach/discount-codes
 * Create a new discount code scoped to this coach.
 * Body: { code, discount_type, discount_value, currency?, valid_from, valid_until, max_uses?, applicable_service_ids? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const provider_id = await resolveProviderId(user.id);
    if (!provider_id) return NextResponse.json({ error: 'Coach record not found' }, { status: 403 });

    let body: {
      code?: string;
      discount_type?: string;
      discount_value?: number;
      currency?: string;
      valid_from?: string;
      valid_until?: string;
      max_uses?: number;
      applicable_service_ids?: string[];
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { code, discount_type, discount_value, currency, valid_from, valid_until, max_uses, applicable_service_ids } = body;

    // Validate code
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

    // Validate discount_type
    if (!discount_type || !['percentage', 'fixed_amount'].includes(discount_type)) {
      return NextResponse.json(
        { error: 'discount_type must be "percentage" or "fixed_amount"' },
        { status: 400 },
      );
    }

    // Validate discount_value
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

    // Validate dates
    if (!valid_until) {
      return NextResponse.json({ error: 'valid_until is required' }, { status: 400 });
    }
    const fromDate = valid_from ? new Date(valid_from) : new Date();
    const untilDate = new Date(valid_until);
    if (isNaN(untilDate.getTime())) {
      return NextResponse.json({ error: 'valid_until is not a valid date' }, { status: 400 });
    }
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
          provider_id,
          is_active: true,
          current_uses: 0,
        })
        .returning();
    }) as Array<typeof discount_codes.$inferSelect>;

    return NextResponse.json({ discount_code: created }, { status: 201 });
  } catch (err: any) {
    console.error('[api/coach/discount-codes POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/discount-codes
 * Deactivate (soft delete) a discount code owned by this coach.
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const provider_id = await resolveProviderId(user.id);
    if (!provider_id) return NextResponse.json({ error: 'Coach record not found' }, { status: 403 });

    let body: { id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Verify ownership — fetch first, return 403 if not found (avoids leaking existence)
    const [existing] = await db
      .select({ id: discount_codes.id, provider_id: discount_codes.provider_id })
      .from(discount_codes)
      .where(eq(discount_codes.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing.provider_id !== provider_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await withAdminContext(async (adminDb) => {
      return adminDb
        .update(discount_codes)
        .set({ is_active: false })
        .where(and(eq(discount_codes.id, id), eq(discount_codes.provider_id, provider_id)));
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/coach/discount-codes DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
