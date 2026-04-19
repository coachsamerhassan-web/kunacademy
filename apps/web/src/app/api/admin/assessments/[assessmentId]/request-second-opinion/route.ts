/**
 * POST /api/admin/assessments/[assessmentId]/request-second-opinion
 *
 * Sets second_opinion_requested_at on the assessment row, audit-logs the
 * action, and enqueues bilingual notification emails to all mentor_managers.
 *
 * Auth: role in ['admin', 'super_admin', 'mentor_manager']
 *
 * Returns 200 { second_opinion_requested_at } on success.
 * Returns 409 if already requested.
 *
 * Notification behaviour:
 *  - Queries all profiles WHERE role='mentor_manager' AND email IS NOT NULL.
 *  - If none found: logs a warning and returns 200 (request still records).
 *  - Enqueues one email_outbox row per mentor_manager inside the same
 *    withAdminContext callback as the UPDATE — atomic rollback on tx failure.
 *  - Enqueue errors are caught and logged; they NEVER block the 200 response.
 *
 * M5 — Mentor-manager escalation review UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, sql } from '@kunacademy/db';
import { packageAssessments } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { logAdminAction } from '@kunacademy/db';
import { enqueueEmail } from '@/lib/email-outbox';

const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kunacademy.com';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

// ── Mentor-manager row returned from the query ────────────────────────────────

interface MentorManagerRow {
  id:           string;
  email:        string;
  display_name: string;
  locale:       'ar' | 'en';
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Load existing assessment ────────────────────────────────────────────────
  const rows = await withAdminContext(async (db) => {
    return db
      .select({
        id:                          packageAssessments.id,
        second_opinion_requested_at: packageAssessments.second_opinion_requested_at,
      })
      .from(packageAssessments)
      .where(eq(packageAssessments.id, assessmentId))
      .limit(1);
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  // Already requested
  if (rows[0].second_opinion_requested_at) {
    return NextResponse.json(
      {
        error: 'Second opinion already requested',
        error_ar: 'طُلب رأي ثانٍ مسبقاً',
        second_opinion_requested_at: rows[0].second_opinion_requested_at,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();

  // ── Fetch context for notification (student name + assessor name) ────────────
  // assessments → recordings → instances → student profile + assessor profile
  interface AssessmentContext {
    student_name:   string;
    assessor_name:  string;
    assigned_at:    string;
  }

  let assessmentCtx: AssessmentContext = {
    student_name:  'Unknown student',
    assessor_name: user.name ?? user.email ?? 'Assessor',
    assigned_at:   now,
  };

  try {
    // Alias student and assessor profiles so Drizzle can select both in one query
    const ctxRows = await withAdminContext(async (db) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(sp.full_name_en, ''), NULLIF(sp.full_name_ar, ''), sp.email) AS student_name,
          COALESCE(NULLIF(ap.full_name_en, ''), NULLIF(ap.full_name_ar, ''), ap.email) AS assessor_name,
          pa.assigned_at
        FROM   package_assessments pa
        JOIN   package_recordings  pr ON pr.id = pa.recording_id
        JOIN   package_instances   pi ON pi.id = pr.package_instance_id
        JOIN   profiles            sp ON sp.id = pi.student_id
        JOIN   profiles            ap ON ap.id = pa.assessor_id
        WHERE  pa.id = ${assessmentId}
        LIMIT  1
      `);
      return result.rows as Array<{ student_name: string; assessor_name: string; assigned_at: string }>;
    });

    if (ctxRows.length > 0) {
      assessmentCtx = {
        student_name:  ctxRows[0].student_name  ?? 'Unknown student',
        assessor_name: ctxRows[0].assessor_name ?? assessmentCtx.assessor_name,
        assigned_at:   ctxRows[0].assigned_at   ?? now,
      };
    }
  } catch (ctxErr) {
    // Non-fatal — proceed without enriched context
    console.warn('[request-second-opinion] Failed to fetch assessment context for notification:', ctxErr);
  }

  // ── Step 2: Query all mentor_managers ────────────────────────────────────────
  // SELECT id, email, COALESCE(NULLIF(full_name_en,''), NULLIF(full_name_ar,''), email) AS display_name,
  //        COALESCE(preferred_language, 'ar') AS locale
  // FROM   profiles
  // WHERE  role = 'mentor_manager' AND email IS NOT NULL
  const mentorManagers = await withAdminContext(async (db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await db.execute(sql`
      SELECT
        id,
        email,
        COALESCE(NULLIF(full_name_en, ''), NULLIF(full_name_ar, ''), email) AS display_name,
        COALESCE(preferred_language, 'ar') AS locale
      FROM   profiles
      WHERE  role = 'mentor_manager'
        AND  email IS NOT NULL
    `);
    return result.rows as MentorManagerRow[];
  });

  if (mentorManagers.length === 0) {
    console.warn(
      '[request-second-opinion] No mentor_manager profiles with email found — ' +
      'second-opinion recorded but no notifications sent.',
    );
  }

  // ── Step 4: UPDATE + enqueue inside one withAdminContext (atomic) ─────────────
  await withAdminContext(async (db) => {
    // Business write: mark second opinion requested
    await db
      .update(packageAssessments)
      .set({ second_opinion_requested_at: now })
      .where(eq(packageAssessments.id, assessmentId));

    // Enqueue one email per mentor_manager — rolls back atomically if tx fails
    for (const mm of mentorManagers) {
      const locale = mm.locale === 'en' ? 'en' : 'ar';
      const escalationUrl = `${SITE_BASE_URL}/${locale}/admin/escalations/${assessmentId}`;

      const submittedDate = new Date(assessmentCtx.assigned_at).toLocaleDateString(
        locale === 'ar' ? 'ar-AE' : 'en-AE',
        { year: 'numeric', month: 'long', day: 'numeric' },
      );
      const assessmentSummary = locale === 'ar'
        ? `تقييم مقدَّم بتاريخ ${submittedDate} — الطالب: ${assessmentCtx.student_name}`
        : `Assessment submitted on ${submittedDate} — student: ${assessmentCtx.student_name}`;

      try {
        await enqueueEmail(db, {
          template_key: 'second-opinion-request',
          to_email:     mm.email,
          payload: {
            recipient_name:      mm.display_name,
            locale,
            requester_name:      assessmentCtx.assessor_name,
            student_name:        assessmentCtx.student_name,
            assessment_summary:  assessmentSummary,
            escalation_url:      escalationUrl,
          },
        });
      } catch (enqueueErr) {
        // Non-blocking — log and continue to next recipient
        console.error(
          `[request-second-opinion] Failed to enqueue email for mentor_manager ${mm.id}:`,
          enqueueErr,
        );
      }
    }
  });

  // ── Audit log (non-blocking) ────────────────────────────────────────────────
  void logAdminAction({
    adminId:    user.id,
    action:     'REQUEST_SECOND_OPINION',
    targetType: 'package_assessment',
    targetId:   assessmentId,
    metadata:   { requested_at: now, notified_count: mentorManagers.length },
  });

  return NextResponse.json({ second_opinion_requested_at: now }, { status: 200 });
}
