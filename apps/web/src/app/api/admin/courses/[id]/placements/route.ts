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
import { eq, and, asc, desc, sql, count } from 'drizzle-orm';

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

// ─── POST /api/admin/courses/[id]/placements ──────────────────────────────
// Add a lesson to a course at a section + sort_order slot.
//
// Body:
//   lesson_id         (required)
//   section_id        (optional; null = no section)
//   sort_order        (optional; if omitted, appended within section)
//   override_title_ar (optional)
//   override_title_en (optional)
//
// Auth: admin OR the course's assigned instructor (D5 RLS 0047).
// LESSON-BLOCKS Session B — 2026-04-22
export async function POST(
  request: NextRequest,
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
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const lesson_id = typeof body.lesson_id === 'string' ? body.lesson_id : '';
    if (!lesson_id) {
      return NextResponse.json({ error: 'lesson_id is required' }, { status: 400 });
    }

    const section_id =
      typeof body.section_id === 'string' && body.section_id ? body.section_id : null;

    // Resolve sort_order: explicit or append within section.
    let sort_order: number;
    if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
      sort_order = Math.max(0, Math.floor(body.sort_order));
    } else {
      const whereClause = section_id
        ? and(
            eq(lesson_placements.course_id, courseId),
            eq(lesson_placements.section_id, section_id)
          )
        : and(
            eq(lesson_placements.course_id, courseId),
            sql`${lesson_placements.section_id} IS NULL`
          );
      const maxRows = await withAdminContext(async (adminDb) =>
        adminDb
          .select({ sort_order: lesson_placements.sort_order })
          .from(lesson_placements)
          .where(whereClause)
          .orderBy(desc(lesson_placements.sort_order))
          .limit(1)
      );
      sort_order = maxRows.length > 0 ? (maxRows[0].sort_order ?? 0) + 1 : 0;
    }

    try {
      const inserted = await withAdminContext(async (adminDb) =>
        adminDb
          .insert(lesson_placements)
          .values({
            course_id: courseId,
            section_id: section_id ?? undefined,
            lesson_id,
            sort_order,
            override_title_ar:
              typeof body.override_title_ar === 'string' ? body.override_title_ar : undefined,
            override_title_en:
              typeof body.override_title_en === 'string' ? body.override_title_en : undefined,
          })
          .returning()
      );
      return NextResponse.json({ placement: inserted[0] }, { status: 201 });
    } catch (err: any) {
      if (err?.code === '23505') {
        return NextResponse.json(
          {
            error: 'Placement conflict: lesson already placed in this course/section, or sort_order taken',
            code: 'placement_conflict',
          },
          { status: 409 }
        );
      }
      if (err?.code === '23503') {
        return NextResponse.json(
          { error: 'Invalid lesson_id or section_id', code: 'fk_violation' },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (err: any) {
    console.error('[api/admin/courses/[id]/placements POST]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
