/**
 * GET /api/admin/assessors
 *
 * Returns all active assessors (instructors with service_roles @> '{advanced_mentor}')
 * for use in reassignment dropdowns and admin tooling.
 *
 * Auth: role in ['admin', 'super_admin', 'mentor_manager']
 *
 * Returns: { assessors: Array<{ profile_id, name, email }> }
 *
 * Phase: M5-ext — assessor reassignment UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql, eq } from '@kunacademy/db';
import { instructors, profiles } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);

export async function GET(_request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Query all active advanced_mentor instructors ────────────────────────────
  const rows = await withAdminContext(async (db) => {
    return db
      .select({
        profile_id:   instructors.profile_id,
        full_name_ar: profiles.full_name_ar,
        full_name_en: profiles.full_name_en,
        email:        profiles.email,
      })
      .from(instructors)
      .innerJoin(profiles, eq(profiles.id, instructors.profile_id))
      .where(
        sql`${instructors.service_roles} @> ARRAY['advanced_mentor']::text[]
        AND ${instructors.profile_id} IS NOT NULL`,
      )
      .orderBy(profiles.full_name_en, profiles.full_name_ar);
  });

  type AssessorRow = { profile_id: string | null; full_name_ar: string | null; full_name_en: string | null; email: string };
  const assessors = (rows as AssessorRow[]).map((r) => ({
    profile_id: r.profile_id,
    name:       r.full_name_en ?? r.full_name_ar ?? r.email,
    email:      r.email,
  }));

  return NextResponse.json({ assessors });
}
