import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, asc, inArray } from 'drizzle-orm';
import { profiles, providers } from '@kunacademy/db/schema';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** GET /api/admin/coaches-list — profiles with role='provider' for coach override dropdown.
 *  Returns both the profile id (id) and the provider row id (provider_id) so callers can
 *  use whichever FK is needed (commissions → profile id, bookings → provider_id).
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const coachRows = await db
      .select({ id: profiles.id, full_name_en: profiles.full_name_en, full_name_ar: profiles.full_name_ar })
      .from(profiles)
      .where(eq(profiles.role, 'provider'))
      .orderBy(asc(profiles.full_name_en));

    // Look up provider rows so callers that need bookings.provider_id can get it
    const profileIds = coachRows.map((c) => c.id);
    const providerRows = profileIds.length
      ? await db
          .select({ id: providers.id, profile_id: providers.profile_id })
          .from(providers)
          .where(inArray(providers.profile_id, profileIds))
      : [];

    const providerByProfile = Object.fromEntries(providerRows.map((p) => [p.profile_id, p.id]));

    const result = coachRows.map((c) => ({
      id: c.id,
      full_name: c.full_name_en ?? c.full_name_ar ?? '',
      // provider_id is the FK stored in bookings.provider_id; may be null if no provider row yet
      provider_id: providerByProfile[c.id] ?? null,
      name_ar: c.full_name_ar ?? null,
      name_en: c.full_name_en ?? null,
    }));

    return NextResponse.json({ coaches: result });
  } catch (err: any) {
    console.error('[api/admin/coaches-list]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
