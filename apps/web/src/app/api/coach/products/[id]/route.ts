import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { services, instructors } from '@kunacademy/db/schema';

async function requireCoach(userId: string) {
  const rows = await db
    .select({ id: instructors.id })
    .from(instructors)
    .where(eq(instructors.profile_id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * PUT /api/coach/products/[id]
 * Update a service by ID.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await requireCoach(user.id)) return NextResponse.json({ error: 'No coach profile' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const {
      name_ar, name_en, description_ar, description_en,
      duration_minutes, price_aed, price_egp, price_usd,
      category_id, sessions_count, validity_days, is_active,
    } = body;

    const updates: Record<string, unknown> = {};
    if (name_ar !== undefined) updates.name_ar = name_ar.trim();
    if (name_en !== undefined) updates.name_en = name_en.trim();
    if (description_ar !== undefined) updates.description_ar = description_ar?.trim() || null;
    if (description_en !== undefined) updates.description_en = description_en?.trim() || null;
    if (duration_minutes !== undefined) updates.duration_minutes = Number(duration_minutes);
    if (price_aed !== undefined) updates.price_aed = Number(price_aed);
    if (price_egp !== undefined) updates.price_egp = Number(price_egp);
    if (price_usd !== undefined) updates.price_usd = Number(price_usd);
    if (category_id !== undefined) updates.category_id = category_id || null;
    if (sessions_count !== undefined) updates.sessions_count = sessions_count ? Number(sessions_count) : null;
    if (validity_days !== undefined) updates.validity_days = validity_days ? Number(validity_days) : null;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(services)
      .set(updates)
      .where(eq(services.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ service: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/coach/products/[id] PUT]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/products/[id]
 * Delete a service by ID.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await requireCoach(user.id)) return NextResponse.json({ error: 'No coach profile' }, { status: 403 });

    const { id } = await params;
    const [deleted] = await db
      .delete(services)
      .where(eq(services.id, id))
      .returning({ id: services.id });

    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/coach/products/[id] DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
