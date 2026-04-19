/**
 * POST /api/admin/assessments/[assessmentId]/resolve-second-opinion
 *
 * Clears second_opinion_requested_at (sets to NULL), marking the second-opinion
 * request as resolved. Mirrors the request-second-opinion endpoint with reverse
 * semantics.
 *
 * Auth: role in ['admin', 'super_admin', 'mentor_manager']
 *
 * Returns 200 { resolved: true } on success.
 * Returns 409 if no second opinion was pending.
 * Returns 404 if the assessment does not exist.
 *
 * M5-gap2-fix — resolve second-opinion queue entries
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

  // Nothing to resolve
  if (!rows[0].second_opinion_requested_at) {
    return NextResponse.json(
      {
        error: 'No pending second opinion on this assessment',
        error_ar: 'لا يوجد طلب رأي ثانٍ معلّق لهذا التقييم',
      },
      { status: 409 },
    );
  }

  const resolvedAt = new Date().toISOString();

  // ── Clear the timestamp ─────────────────────────────────────────────────────
  await withAdminContext(async (db) => {
    await db
      .update(packageAssessments)
      .set({ second_opinion_requested_at: null })
      .where(eq(packageAssessments.id, assessmentId));
  });

  // ── Audit log (non-blocking) ────────────────────────────────────────────────
  void logAdminAction({
    adminId:    user.id,
    action:     'RESOLVE_SECOND_OPINION',
    targetType: 'package_assessment',
    targetId:   assessmentId,
    metadata:   {
      resolved_at:                  resolvedAt,
      was_requested_at:             rows[0].second_opinion_requested_at,
      resolved_by_role:             user.role,
    },
  });

  return NextResponse.json({ resolved: true, resolved_at: resolvedAt }, { status: 200 });
}
