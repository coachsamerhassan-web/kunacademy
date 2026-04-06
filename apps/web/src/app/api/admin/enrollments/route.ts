import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc, asc } from 'drizzle-orm';
import { profiles, enrollments, courses } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

/** GET /api/admin/enrollments — list enrollments with user + course data */
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`
          SELECT
            e.id, e.status, e.enrollment_type, e.enrolled_at, e.completed_at,
            p.full_name_ar AS user_full_name_ar, p.full_name_en AS user_full_name_en, p.email AS user_email,
            c.title_ar AS course_title_ar, c.title_en AS course_title_en
          FROM enrollments e
          LEFT JOIN profiles p ON p.id = e.user_id
          LEFT JOIN courses c ON c.id = e.course_id
          ORDER BY e.enrolled_at DESC
          LIMIT 50
        `
      );
      return result.rows as any[];
    });

    // Shape to match the component's expected structure
    const shaped = rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      enrollment_type: r.enrollment_type,
      enrolled_at: r.enrolled_at,
      completed_at: r.completed_at,
      user: r.user_email ? { full_name_ar: r.user_full_name_ar, full_name_en: r.user_full_name_en, email: r.user_email } : null,
      course: r.course_title_en ? { title_ar: r.course_title_ar, title_en: r.course_title_en } : null,
    }));

    return NextResponse.json({ enrollments: shaped });
  } catch (err: any) {
    console.error('[api/admin/enrollments GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/admin/enrollments — manually enroll a student */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { user_id, course_id, enrollment_type } = await request.json();
    if (!user_id || !course_id) {
      return NextResponse.json({ error: 'user_id and course_id required' }, { status: 400 });
    }

    const created = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`
          INSERT INTO enrollments (user_id, course_id, enrollment_type, status, enrolled_at)
          VALUES (${user_id}, ${course_id}, ${enrollment_type || 'recorded'}, 'enrolled', NOW())
          RETURNING *
        `
      );
      return result.rows[0] as any;
    });

    // Fetch joined data for response
    const enriched = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`
          SELECT
            e.id, e.status, e.enrollment_type, e.enrolled_at, e.completed_at,
            p.full_name_ar AS user_full_name_ar, p.full_name_en AS user_full_name_en, p.email AS user_email,
            c.title_ar AS course_title_ar, c.title_en AS course_title_en
          FROM enrollments e
          LEFT JOIN profiles p ON p.id = e.user_id
          LEFT JOIN courses c ON c.id = e.course_id
          WHERE e.id = ${created.id}
        `
      );
      return result.rows[0] as any;
    });

    const enrollment = {
      id: enriched.id,
      status: enriched.status,
      enrollment_type: enriched.enrollment_type,
      enrolled_at: enriched.enrolled_at,
      completed_at: enriched.completed_at,
      user: enriched.user_email ? { full_name_ar: enriched.user_full_name_ar, full_name_en: enriched.user_full_name_en, email: enriched.user_email } : null,
      course: enriched.course_title_en ? { title_ar: enriched.course_title_ar, title_en: enriched.course_title_en } : null,
    };

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/enrollments POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PATCH /api/admin/enrollments — mark enrollment complete */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { enrollment_id } = await request.json();
    if (!enrollment_id) return NextResponse.json({ error: 'enrollment_id required' }, { status: 400 });

    await withAdminContext(async (adminDb) => {
      await adminDb.execute(
        sql`UPDATE enrollments SET status = 'completed', completed_at = NOW() WHERE id = ${enrollment_id}`
      );
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/enrollments PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
