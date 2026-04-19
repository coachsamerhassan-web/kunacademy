/**
 * POST /api/admin/assessments/[assessmentId]/override
 *
 * Allows a mentor_manager (or admin/super_admin) to override an assessor's
 * pass/fail decision with a required written reason.
 *
 * Auth: role in ['admin', 'super_admin', 'mentor_manager']
 *
 * Body: { new_decision: 'pass' | 'fail', reason: string }
 *
 * Logic:
 *   1. Validate body (new_decision enum + reason non-empty)
 *   2. Load existing assessment row (must exist)
 *   3. If new_decision === existing decision → 409 (no-op guard)
 *   4. If overriding to 'pass' AND ethics_auto_failed=true →
 *      clear ethics_auto_failed (override explicitly overrules ethics gate;
 *      mentor_manager takes on accountability)
 *   5. UPDATE package_assessments: decision, override_reason, override_by,
 *      decided_at, ethics_auto_failed (cleared if flipping to pass)
 *   6. Enqueue email to student notifying them of revised result (atomic)
 *   7. Audit log: OVERRIDE_ASSESSMENT_DECISION (non-blocking)
 *
 * M5 — Mentor-manager escalation review UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, sql } from '@kunacademy/db';
import {
  packageAssessments,
  packageRecordings,
  packageInstances,
  profiles,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { logAdminAction } from '@kunacademy/db';
import { enqueueEmail } from '@/lib/email-outbox';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

interface OverrideBody {
  new_decision: 'pass' | 'fail';
  reason: string;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden — requires mentor_manager or admin role' }, { status: 403 });
  }

  // ── Parse + validate body ───────────────────────────────────────────────────
  let body: OverrideBody;
  try {
    body = (await request.json()) as OverrideBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  if (body.new_decision !== 'pass' && body.new_decision !== 'fail') {
    return NextResponse.json(
      { error: 'new_decision must be "pass" or "fail"' },
      { status: 400 },
    );
  }

  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    return NextResponse.json(
      { error: 'reason is required and must be a non-empty string' },
      { status: 400 },
    );
  }

  const trimmedReason = body.reason.trim();

  // ── Load existing assessment ────────────────────────────────────────────────
  const rows = await withAdminContext(async (db) => {
    return db
      .select({
        id:                  packageAssessments.id,
        decision:            packageAssessments.decision,
        ethics_auto_failed:  packageAssessments.ethics_auto_failed,
        recording_id:        packageAssessments.recording_id,
        package_instance_id: packageRecordings.package_instance_id,
      })
      .from(packageAssessments)
      .innerJoin(packageRecordings, eq(packageRecordings.id, packageAssessments.recording_id))
      .where(eq(packageAssessments.id, assessmentId))
      .limit(1);
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  const existing = rows[0];
  const priorDecision = existing.decision;

  // No-op guard: overriding to the same decision adds no value
  if (priorDecision === body.new_decision) {
    return NextResponse.json(
      {
        error: `Assessment decision is already "${body.new_decision}" — no override needed`,
        error_ar: `قرار التقييم هو بالفعل "${body.new_decision}" — لا حاجة لتجاوزه`,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();

  // If overriding to 'pass' AND ethics_auto_failed=true, the mentor_manager
  // is explicitly overruling the ethics gate. Clear the flag so the CHECK
  // constraint (ethics_auto_failed=true → decision IN ('pending','fail')) is satisfied.
  const newEthicsAutoFailed =
    body.new_decision === 'pass' ? false : existing.ethics_auto_failed;

  // ── Atomic transaction: update + enqueue email ──────────────────────────────
  await withAdminContext(async (db) => {
    // 1. Write override
    await db
      .update(packageAssessments)
      .set({
        decision:            body.new_decision,
        decided_at:          now,
        ethics_auto_failed:  newEthicsAutoFailed,
        override_reason:     trimmedReason,
        override_by:         user.id,
      })
      .where(eq(packageAssessments.id, assessmentId));

    // 2. Fetch student profile for notification
    const studentRows = await db
      .select({
        email:              profiles.email,
        full_name_ar:       profiles.full_name_ar,
        full_name_en:       profiles.full_name_en,
        preferred_language: profiles.preferred_language,
      })
      .from(packageInstances)
      .innerJoin(profiles, eq(profiles.id, packageInstances.student_id))
      .where(eq(packageInstances.id, existing.package_instance_id))
      .limit(1);

    if (studentRows.length > 0) {
      const student = studentRows[0];
      const locale  = (student.preferred_language === 'en' ? 'en' : 'ar') as 'ar' | 'en';
      const name    = locale === 'ar'
        ? (student.full_name_ar ?? student.full_name_en ?? '')
        : (student.full_name_en ?? student.full_name_ar ?? '');

      const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kunacademy.com';
      const result_url = `${APP_URL}/${locale}/portal/packages/${existing.package_instance_id}/assessment`;

      // 3. Enqueue result email — atomic with the UPDATE above
      await enqueueEmail(db, {
        template_key: 'assessment-result',
        to_email:     student.email,
        payload:      {
          student_name: name,
          locale,
          decision:     body.new_decision,
          result_url,
          is_fail:      body.new_decision === 'fail',
          override:     true,
          override_reason: trimmedReason,
        },
      });
    } else {
      console.warn('[override-assessment] email skipped: student row not found for instance', existing.package_instance_id);
    }
  });

  // ── Audit log (non-blocking) ────────────────────────────────────────────────
  void logAdminAction({
    adminId:    user.id,
    action:     'OVERRIDE_ASSESSMENT_DECISION',
    targetType: 'package_assessment',
    targetId:   assessmentId,
    metadata:   {
      prior_decision:      priorDecision,
      new_decision:        body.new_decision,
      reason:              trimmedReason,
      ethics_flag_cleared: existing.ethics_auto_failed && body.new_decision === 'pass',
    },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(
    {
      overridden_at:  now,
      prior_decision: priorDecision,
      new_decision:   body.new_decision,
      override_by:    user.id,
    },
    { status: 200 },
  );
}
