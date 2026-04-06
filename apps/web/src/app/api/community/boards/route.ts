import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { isAdminRole } from '@kunacademy/auth';
import {
  community_boards,
  board_members,
  enrollments,
} from '@kunacademy/db/schema';
import { courses } from '@kunacademy/db/schema';
import { eq, inArray, and } from 'drizzle-orm';

/**
 * Community Boards API
 * GET — list boards visible to the user
 * POST — create a cohort board (admin only) and auto-add enrolled students
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    const userId = user?.id || null;

    // Get general + announcement boards (visible to all)
    const publicBoards = await db
      .select({
        id: community_boards.id,
        slug: community_boards.slug,
        name_ar: community_boards.name_ar,
        name_en: community_boards.name_en,
        description_ar: community_boards.description_ar,
        description_en: community_boards.description_en,
        type: community_boards.type,
        is_admin_only: community_boards.is_admin_only,
        created_at: community_boards.created_at,
      })
      .from(community_boards)
      .where(inArray(community_boards.type, ['general', 'announcements']))
      .orderBy(community_boards.created_at);

    // Get cohort boards for this user
    let cohortBoards: typeof community_boards.$inferSelect[] = [];
    if (userId) {
      const memberships = await db
        .select({
          id: community_boards.id,
          slug: community_boards.slug,
          name_ar: community_boards.name_ar,
          name_en: community_boards.name_en,
          description_ar: community_boards.description_ar,
          description_en: community_boards.description_en,
          type: community_boards.type,
          is_admin_only: community_boards.is_admin_only,
          course_id: community_boards.course_id,
          created_at: community_boards.created_at,
        })
        .from(board_members)
        .innerJoin(community_boards, eq(board_members.board_id, community_boards.id))
        .where(eq(board_members.user_id, userId));

      cohortBoards = memberships as typeof community_boards.$inferSelect[];
    }

    return NextResponse.json({
      boards: [...publicBoards, ...cohortBoards],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST — Auto-create a cohort board for a course.
 * Body: { course_id, name_ar?, name_en? }
 *
 * Creates the board and automatically adds all enrolled students as members.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { course_id, name_ar, name_en } = body;

    if (!course_id) {
      return NextResponse.json({ error: 'course_id required' }, { status: 400 });
    }

    // Check if cohort board already exists for this course
    const [existing] = await db
      .select({ id: community_boards.id })
      .from(community_boards)
      .where(
        and(
          eq(community_boards.course_id, course_id),
          eq(community_boards.type, 'cohort')
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({
        error: 'Cohort board already exists for this course',
        board_id: existing.id,
      }, { status: 409 });
    }

    // Get course info for default naming
    const [course] = await db
      .select({
        title_ar: courses.title_ar,
        title_en: courses.title_en,
        slug: courses.slug,
      })
      .from(courses)
      .where(eq(courses.id, course_id))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Create the board + add enrolled students using admin context
    const result = await withAdminContext(async (adminDb) => {
      const slug = `cohort-${course.slug}-${Date.now().toString(36)}`;

      const [board] = await adminDb
        .insert(community_boards)
        .values({
          slug,
          name_ar: name_ar || `مجموعة ${course.title_ar}`,
          name_en: name_en || `${course.title_en} Cohort`,
          description_ar: `مساحة خاصة لطلاب ${course.title_ar}`,
          description_en: `Private space for ${course.title_en} students`,
          type: 'cohort',
          course_id,
          is_admin_only: false,
        })
        .returning({ id: community_boards.id, slug: community_boards.slug });

      // Auto-add all enrolled students as board members
      const enrolledStudents = await adminDb
        .select({ user_id: enrollments.user_id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.course_id, course_id),
            inArray(enrollments.status, ['active', 'completed'])
          )
        );

      if (enrolledStudents.length) {
        const members = enrolledStudents.map((e: { user_id: string }) => ({
          board_id: board.id,
          user_id: e.user_id,
          role: 'member',
        }));

        try {
          await adminDb.insert(board_members).values(members).onConflictDoNothing();
        } catch (memberErr) {
          console.error('[community/boards] Member insert error:', memberErr);
        }
      }

      return { board, membersAdded: enrolledStudents.length };
    });

    return NextResponse.json({
      board_id: result.board.id,
      slug: result.board.slug,
      members_added: result.membersAdded,
    }, { status: 201 });
  } catch (e) {
    console.error('[community/boards]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
