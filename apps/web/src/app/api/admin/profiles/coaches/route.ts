/**
 * GET /api/admin/profiles/coaches
 *
 * Phase 2b support endpoint — powers the admin instructor-form's searchable
 * profile-dropdown (the public coach-ratings BRIDGE).
 *
 * Returns all profiles whose role is coach/super_admin — the eligible targets
 * for linking an `instructors.profile_id` FK. Admin-only.
 *
 * D11 (2026-04-22): each coach row now includes `linked_instructor_id` +
 * `linked_instructor_slug` + `linked_instructor_name_en` so the picker UI can
 * surface a soft-warning ("already linked to X") before the admin commits.
 * The DB already enforces uniqueness via partial unique index
 * `idx_instructors_profile_id_unique` — this is the friendly front layer.
 */

import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, sql } from 'drizzle-orm';
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

export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // LEFT JOIN so unlinked coaches still appear; ORDER BY name for stable UX.
    const result = await db.execute(sql`
      SELECT
        p.id,
        p.email,
        p.full_name_ar,
        p.full_name_en,
        p.role,
        ins.id   AS linked_instructor_id,
        ins.slug AS linked_instructor_slug,
        ins.name_en AS linked_instructor_name_en,
        ins.name_ar AS linked_instructor_name_ar
      FROM profiles p
      LEFT JOIN instructors ins ON ins.profile_id = p.id
      WHERE p.role IN ('coach', 'super_admin')
      ORDER BY p.full_name_en ASC NULLS LAST, p.email ASC
    `);

    return NextResponse.json({ coaches: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/profiles/coaches GET]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
