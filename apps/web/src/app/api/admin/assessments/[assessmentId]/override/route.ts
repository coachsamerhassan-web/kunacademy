/**
 * POST /api/admin/assessments/[assessmentId]/override
 *
 * Allows a mentor_manager (or admin/super_admin) to override an assessor's
 * pass/fail decision with a required written reason.
 *
 * Auth: role in ['admin', 'super_admin', 'mentor_manager']
 *
 * Body: {
 *   new_decision: 'pass' | 'fail',
 *   reason: string,                        // ≥ 30 chars when clearing ethics flag
 *   acknowledge_ethics_override?: boolean, // REQUIRED when new_decision='pass' AND ethics_auto_failed=true
 * }
 *
 * Logic:
 *   1. Validate body (new_decision enum + reason non-empty)
 *   2. Load existing assessment row (must exist)
 *   3. Reject if assessment.decision === 'pending' (FIX M4: no pre-review overrides)
 *   4. If new_decision === existing decision → 409 (no-op guard)
 *   5. If overriding to 'pass' AND ethics_auto_failed=true:
 *      - require reason ≥ 30 chars (FIX H2: meaningful justification)
 *      - require acknowledge_ethics_override === true in body (FIX H2: explicit acknowledgement)
 *      - clear ethics_auto_failed flag + mark ethics_override_explicit=true in audit log
 *   6. UPDATE package_assessments: decision, override_reason, override_by,
 *      decided_at, ethics_auto_failed (cleared if flipping to pass with explicit ack)
 *   7. If new_decision='pass' AND package_instance.journey_state='paused':
 *      auto-transition paused → second_try_pending via state machine (FIX M3)
 *      + audit log OVERRIDE_AUTO_UNPAUSE
 *   8. Enqueue email to student notifying them of revised result (atomic)
 *   9. Audit log: OVERRIDE_ASSESSMENT_DECISION (non-blocking)
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
import { transitionPackageState } from '@/lib/mentoring/state-machine';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

interface OverrideBody {
  new_decision: 'pass' | 'fail';
  reason: string;
  acknowledge_ethics_override?: boolean;
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

  // FIX H2: When flipping to pass and an ethics override may be involved,
  // enforce a minimum reason length (checked again below once we know the flag).
  // Early-reject obviously short reasons for all pass overrides defensively.
  // (Full 30-char check is enforced below after we load the ethics flag.)

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

  // FIX M4: Reject override of a pending assessment — assessor must submit first.
  if (priorDecision === 'pending') {
    return NextResponse.json(
      {
        error: 'Cannot override a pending assessment. Wait for the assessor\'s initial review.',
        error_ar: 'لا يمكن تجاوز تقييم معلق. انتظر حتى يُكمل المُقيِّم مراجعته الأولية.',
      },
      { status: 400 },
    );
  }

  // FIX H2: When flipping to 'pass' with ethics_auto_failed=true, require:
  //   (a) reason ≥ 30 characters — meaningful written justification
  //   (b) acknowledge_ethics_override === true — explicit acknowledgement
  const isEthicsOverride = body.new_decision === 'pass' && existing.ethics_auto_failed === true;
  if (isEthicsOverride) {
    if (trimmedReason.length < 30) {
      return NextResponse.json(
        {
          error: 'When overriding an ethics-failed assessment, reason must be at least 30 characters.',
          error_ar: 'عند تجاوز تقييم فشل بسبب الأخلاقيات، يجب أن يكون سبب التجاوز 30 حرفاً على الأقل.',
        },
        { status: 400 },
      );
    }
    if (body.acknowledge_ethics_override !== true) {
      return NextResponse.json(
        {
          error: 'acknowledge_ethics_override must be true when overriding an ethics-failed assessment to pass.',
          error_ar: 'يجب تعيين acknowledge_ethics_override على true عند تجاوز حالة فشل أخلاقي إلى نجاح.',
        },
        { status: 400 },
      );
    }
  }

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
  // has explicitly acknowledged the ethics gate bypass (checked above).
  // Clear the flag so the CHECK constraint
  // (ethics_auto_failed=true → decision IN ('pending','fail')) is satisfied.
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

  // ── FIX M3: Auto-unpause journey if overriding to 'pass' from 'paused' state ─
  // Fetch current journey_state and transition paused → second_try_pending.
  let autoUnpaused = false;
  if (body.new_decision === 'pass') {
    try {
      // We need to read package_instance.journey_state via the instance id
      // obtained during the assessment load above.
      const instanceId = existing.package_instance_id;
      if (instanceId) {
        const stateRows = await withAdminContext(async (db) => {
          return db.execute(
            sql`SELECT journey_state FROM package_instances WHERE id = ${instanceId} LIMIT 1`
          );
        });
        const stateRow = (stateRows.rows as Array<{ journey_state: string }>)[0];
        if (stateRow?.journey_state === 'paused') {
          await transitionPackageState(instanceId, 'second_try_pending', user.id);
          autoUnpaused = true;
          // Audit log the auto-unpause (non-blocking)
          void logAdminAction({
            adminId:    user.id,
            action:     'OVERRIDE_AUTO_UNPAUSE',
            targetType: 'package_instance',
            targetId:   instanceId,
            metadata:   {
              assessment_id:    assessmentId,
              prior_state:      'paused',
              new_state:        'second_try_pending',
              triggered_by_override: true,
            },
            ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
          });
        }
      }
    } catch (err) {
      // Log but do not fail the override — assessment decision already committed.
      console.error('[override-assessment] auto-unpause failed:', err);
    }
  }

  // ── Audit log (non-blocking) ────────────────────────────────────────────────
  void logAdminAction({
    adminId:    user.id,
    action:     'OVERRIDE_ASSESSMENT_DECISION',
    targetType: 'package_assessment',
    targetId:   assessmentId,
    metadata:   {
      prior_decision:           priorDecision,
      new_decision:             body.new_decision,
      reason:                   trimmedReason,
      ethics_flag_cleared:      isEthicsOverride,
      ethics_override_explicit: isEthicsOverride ? true : undefined,
      auto_unpaused:            autoUnpaused,
    },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(
    {
      overridden_at:  now,
      prior_decision: priorDecision,
      new_decision:   body.new_decision,
      override_by:    user.id,
      auto_unpaused:  autoUnpaused,
    },
    { status: 200 },
  );
}
