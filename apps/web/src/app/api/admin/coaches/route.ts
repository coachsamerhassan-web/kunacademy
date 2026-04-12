import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc } from 'drizzle-orm';
import { profiles, providers } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

/**
 * GET /api/admin/coaches
 * List all coaches (providers) with their can_offer_courses status.
 */
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await db
      .select({
        provider_id: providers.id,
        profile_id: providers.profile_id,
        is_visible: providers.is_visible,
        can_offer_courses: providers.can_offer_courses,
        full_name_en: profiles.full_name_en,
        full_name_ar: profiles.full_name_ar,
        email: profiles.email,
      })
      .from(providers)
      .innerJoin(profiles, eq(providers.profile_id, profiles.id))
      .orderBy(asc(profiles.full_name_en));

    return NextResponse.json({ coaches: rows });
  } catch (err: any) {
    console.error('[api/admin/coaches GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/coaches
 * Toggle can_offer_courses for a specific provider.
 * Body: { provider_id: string, can_offer_courses: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { provider_id, can_offer_courses } = body as {
      provider_id?: string;
      can_offer_courses?: boolean;
    };

    if (!provider_id || can_offer_courses === undefined) {
      return NextResponse.json(
        { error: 'provider_id and can_offer_courses are required' },
        { status: 400 }
      );
    }

    if (typeof can_offer_courses !== 'boolean') {
      return NextResponse.json(
        { error: 'can_offer_courses must be a boolean' },
        { status: 400 }
      );
    }

    // Verify the provider exists before updating
    const existing = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.id, provider_id))
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    await withAdminContext(async (adminDb) => {
      await adminDb.execute(
        sql`UPDATE providers SET can_offer_courses = ${can_offer_courses} WHERE id = ${provider_id}`
      );
    });

    return NextResponse.json({ success: true, provider_id, can_offer_courses });
  } catch (err: any) {
    console.error('[api/admin/coaches PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
