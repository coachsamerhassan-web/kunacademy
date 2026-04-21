/**
 * GET /api/admin/profiles/coaches
 *
 * Phase 2b support endpoint — powers the admin instructor-form's searchable
 * profile-dropdown (the public coach-ratings BRIDGE).
 *
 * Returns all profiles whose role is coach/super_admin — the eligible targets
 * for linking an `instructors.profile_id` FK. Admin-only.
 */

import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, inArray, asc } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

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

const COACH_ROLES = ['coach', 'super_admin'] as const;

export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        full_name_ar: profiles.full_name_ar,
        full_name_en: profiles.full_name_en,
        role: profiles.role,
      })
      .from(profiles)
      .where(inArray(profiles.role, COACH_ROLES as unknown as string[]))
      .orderBy(asc(profiles.full_name_en));

    return NextResponse.json({ coaches: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/profiles/coaches GET]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
