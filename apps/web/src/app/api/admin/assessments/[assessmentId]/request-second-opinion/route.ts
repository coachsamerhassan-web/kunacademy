/**
 * POST /api/admin/assessments/[assessmentId]/request-second-opinion
 *
 * Stub — sets second_opinion_requested_at on the assessment row and audit-logs
 * the action. Real second-opinion workflow (assignment, notification, UI) to be
 * wired by Samer in a future phase.
 *
 * Auth: role in ['admin', 'super_admin', 'mentor_manager']
 *
 * Returns 200 { second_opinion_requested_at } on success.
 * Returns 409 if already requested.
 *
 * M5 — Mentor-manager escalation review UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq } from '@kunacademy/db';
import { packageAssessments } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { logAdminAction } from '@kunacademy/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
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

  // ── Update ──────────────────────────────────────────────────────────────────
  await withAdminContext(async (db) => {
    await db
      .update(packageAssessments)
      .set({ second_opinion_requested_at: now })
      .where(eq(packageAssessments.id, assessmentId));
  });

  // ── Audit log (non-blocking) ────────────────────────────────────────────────
  void logAdminAction({
    adminId:    user.id,
    action:     'REQUEST_SECOND_OPINION',
    targetType: 'package_assessment',
    targetId:   assessmentId,
    metadata:   { requested_at: now },
  });

  return NextResponse.json({ second_opinion_requested_at: now }, { status: 200 });
}
