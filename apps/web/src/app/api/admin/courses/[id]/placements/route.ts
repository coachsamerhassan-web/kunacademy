/**
 * GET /api/admin/courses/[id]/placements
 *
 * Returns placements for a course, ordered by section (nulls last) + sort_order,
 * joined to the underlying lesson (title + scope + created_by) and block_count.
 *
 * Auth: admin + super_admin only.
 *
 * LESSON-BLOCKS Session A — 2026-04-22
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import {
  profiles,
  lessons,
  lesson_placements,
  lesson_blocks,
  course_sections,
} from '@kunacademy/db/schema';
import { db } from '@kunacademy/db';
import { eq, asc, sql, count } from 'drizzle-orm';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return { kind: 'unauthenticated' as const };
  if (user.role && ADMIN_ROLES.has(user.role)) return { kind: 'ok' as const, user };
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role ?? '';
  if (!ADMIN_ROLES.has(role)) return { kind: 'forbidden' as const };
  return { kind: 'ok' as const, user };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.kind === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: courseId } = await context.params;

    const rows = await withAdminContext(async (adminDb) =>
      adminDb
        .select({
          placement_id:      lesson_placements.id,
          course_id:         lesson_placements.course_id,
          section_id:        lesson_placements.section_id,
          section_title_ar:  course_sections.title_ar,
          section_title_en:  course_sections.title_en,
          section_order:     course_sections.order,
          sort_order:        lesson_placements.sort_order,
          override_title_ar: lesson_placements.override_title_ar,
          override_title_en: lesson_placements.override_title_en,
          lesson_id:         lessons.id,
          lesson_title_ar:   lessons.title_ar,
          lesson_title_en:   lessons.title_en,
          lesson_scope:      lessons.scope,
          lesson_created_by: lessons.created_by,
          lesson_duration_minutes: lessons.duration_minutes,
          block_count:       count(lesson_blocks.id),
        })
        .from(lesson_placements)
        .innerJoin(lessons, eq(lessons.id, lesson_placements.lesson_id))
        .leftJoin(course_sections, eq(course_sections.id, lesson_placements.section_id))
        .leftJoin(lesson_blocks, eq(lesson_blocks.lesson_id, lessons.id))
        .where(eq(lesson_placements.course_id, courseId))
        .groupBy(
          lesson_placements.id,
          lessons.id,
          course_sections.id,
        )
        .orderBy(
          // nulls last on section_order (Postgres default for ASC is nulls last)
          sql`${course_sections.order} ASC NULLS LAST`,
          asc(lesson_placements.sort_order)
        )
    );

    return NextResponse.json({ placements: rows });
  } catch (err: any) {
    console.error('[api/admin/courses/[id]/placements GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
