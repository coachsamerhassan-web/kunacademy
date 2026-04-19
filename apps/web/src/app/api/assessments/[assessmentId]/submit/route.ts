/**
 * POST /api/assessments/[assessmentId]/submit
 *
 * Finalises an assessment: validates all required rubric fields server-side,
 * enforces the ethics auto-fail gate, writes the final decision, advances the
 * package_instance journey state, and emits an audit log row.
 *
 * Auth: session user must be the assigned assessor OR admin/mentor_manager.
 * Status gate: 409 if assessment.decision !== 'pending'.
 *
 * Sub-phase: S2-Layer-1 / 2.7 — Pass/fail logic + ethics auto-fail enforcement
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, logAdminAction } from '@kunacademy/db';
import {
  packageAssessments,
  packageRecordings,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import {
  transitionPackageState,
  type JourneyState,
} from '@/lib/mentoring/state-machine';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Required non-conditional item IDs (Part 1 + Part 2) ──────────────────────
// Conditional sub-sections (1.3, 1.4, 1.5, 1.7) are items 10–21 + post-session.
// For those, 'not_applicable' is a valid answer — they are NOT required to be
// observed/not_observed. All other items (1–9, 22–36) must have a state set.
const REQUIRED_OBSERVATION_IDS: number[] = [
  // Sub-section 1.1 — Connecting question + Coaching Agreement (items 1–6)
  1, 2, 3, 4, 5, 6,
  // Sub-section 1.2 — Curiosity Zone (items 7–9)
  7, 8, 9,
  // Sub-section 1.6 — Learnings (items 22–23)
  22, 23,
  // Sub-section 1.8 — Closing (items 24–25)
  24, 25,
  // Part 2 — Behavioral Patterns (items 26–36)
  26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
];

// Conditional items: assessor must supply EITHER observed/not_observed OR not_applicable.
// We validate only that they are not left completely blank (null).
const CONDITIONAL_OBSERVATION_IDS: number[] = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

const ETHICS_GATE_IDS = ['G1', 'G2', 'G3'] as const;

// ── Shape expected in the POST body ──────────────────────────────────────────

interface ObsEntry {
  state: 'observed' | 'not_observed' | 'not_applicable' | null;
  evidence?: string | null;
}

interface SubmitPayload {
  // Part 0 metadata
  sessionDeliveryDate?: string;
  sessionNumber?: string | number;
  sessionLevel?: string | number;
  // Part 1–2 observations
  observations: Record<string, ObsEntry>;
  // Part 3 ethics gates
  ethicsGates: Record<string, 'agree' | 'disagree' | null>;
  // Part 4 summary
  strongestCompetencies: string;
  developmentAreas: string;
  mentorGuidance: string;
  verdict: 'pass' | 'fail';
}

// ── Bilingual validation error builder ────────────────────────────────────────

function err(en: string, ar: string) {
  return { en, ar };
}

interface ValidationError {
  en: string;
  ar: string;
}

function validatePayload(payload: SubmitPayload): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. All required observation items must have a non-null state
  for (const id of REQUIRED_OBSERVATION_IDS) {
    const entry = payload.observations?.[String(id)];
    if (!entry || entry.state === null || entry.state === undefined) {
      errors.push(err(
        `Observation item ${id} has no answer. All required items must be marked observed, not observed, or N/A.`,
        `البند ${id} لم يتم الإجابة عليه. يجب تحديد إجابة لجميع البنود الإلزامية.`,
      ));
    }
  }

  // 2. Conditional observation items must have SOME state (including not_applicable) if present
  for (const id of CONDITIONAL_OBSERVATION_IDS) {
    const entry = payload.observations?.[String(id)];
    if (entry && (entry.state === null || entry.state === undefined)) {
      errors.push(err(
        `Conditional observation item ${id} has no answer.`,
        `البند الاختياري ${id} لم يتم الإجابة عليه.`,
      ));
    }
  }

  // 3. Any observed item must have non-empty evidence
  for (const [key, entry] of Object.entries(payload.observations ?? {})) {
    if (entry?.state === 'observed' && (!entry.evidence || entry.evidence.trim() === '')) {
      errors.push(err(
        `Evidence is required for observed item ${key}. Write the quote and timestamp.`,
        `حقل الدليل مطلوب للبند ${key} المُلاحَظ. اكتب الاقتباس والتوقيت.`,
      ));
    }
  }

  // 4. All ethics gates must be answered
  for (const gateId of ETHICS_GATE_IDS) {
    const val = payload.ethicsGates?.[gateId];
    if (!val || (val !== 'agree' && val !== 'disagree')) {
      errors.push(err(
        `Ethics gate ${gateId} has no answer. All three gates must be answered.`,
        `البوابة الأخلاقية ${gateId} لم تُجَب. يجب الإجابة على جميع البوابات الثلاث.`,
      ));
    }
  }

  // 5. Part 4 summary fields — all required (non-empty)
  if (!payload.strongestCompetencies || payload.strongestCompetencies.trim() === '') {
    errors.push(err(
      'Strongest competencies field (Part 4) is required.',
      'حقل "أقوى الكفاءات" (الجزء الرابع) مطلوب.',
    ));
  }
  if (!payload.developmentAreas || payload.developmentAreas.trim() === '') {
    errors.push(err(
      'Development areas field (Part 4) is required.',
      'حقل "مجالات التطوير" (الجزء الرابع) مطلوب.',
    ));
  }
  if (!payload.mentorGuidance || payload.mentorGuidance.trim() === '') {
    errors.push(err(
      "Mentor's guidance field (Part 4) is required.",
      'حقل "توجيه المشرف" (الجزء الرابع) مطلوب.',
    ));
  }

  // 6. Verdict must be set
  if (!payload.verdict || (payload.verdict !== 'pass' && payload.verdict !== 'fail')) {
    errors.push(err(
      'Final verdict (pass/fail) is required.',
      'النتيجة النهائية (ناجح/راسب) مطلوبة.',
    ));
  }

  // 7. CRITICAL — Ethics auto-fail gate:
  // If any gate = 'disagree', the verdict MUST be 'fail'.
  // Reject the submission with 400 if the client sent verdict='pass' with any disagree.
  const anyEthicsDisagreed = ETHICS_GATE_IDS.some(
    (g) => payload.ethicsGates?.[g] === 'disagree',
  );
  if (anyEthicsDisagreed && payload.verdict === 'pass') {
    errors.push(err(
      'Ethics auto-fail: one or more ethics gates are marked "disagree". The verdict must be "fail". You cannot pass a session with an ethics violation.',
      'فشل أخلاقي تلقائي: إحدى البوابات الأخلاقية أو أكثر مُعلَّمة بـ"لا أوافق". يجب أن تكون النتيجة "راسب". لا يمكن إجازة جلسة بها انتهاك أخلاقي.',
    ));
  }

  return errors;
}

// ── Route context ─────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'mentor_manager';

  // ── Fetch existing row (ownership + status check) ─────────────────────────
  const rows = await withAdminContext(async (db) => {
    return db
      .select({
        id:                  packageAssessments.id,
        assessor_id:         packageAssessments.assessor_id,
        decision:            packageAssessments.decision,
        rubric_scores:       packageAssessments.rubric_scores,
        recording_id:        packageAssessments.recording_id,
        // package_instance_id lives on package_recordings
        package_instance_id: packageRecordings.package_instance_id,
      })
      .from(packageAssessments)
      .innerJoin(
        packageRecordings,
        eq(packageRecordings.id, packageAssessments.recording_id),
      )
      .where(eq(packageAssessments.id, assessmentId))
      .limit(1);
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  const row = rows[0];

  // Non-admin: must be the assigned assessor
  if (!isAdmin && row.assessor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Status gate: refuse if not pending (already submitted)
  if (row.decision !== 'pending') {
    return NextResponse.json(
      {
        error: 'Assessment already submitted — locked',
        error_ar: 'التقييم مُرسَل مسبقاً — مقفل',
      },
      { status: 409 },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload: SubmitPayload;
  try {
    payload = (await request.json()) as SubmitPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  // ── Server-side validation ────────────────────────────────────────────────
  const validationErrors = validatePayload(payload);
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { errors: validationErrors },
      { status: 400 },
    );
  }

  // ── Reconcile ethics auto-fail (server-side override) ────────────────────
  // Even if the client tried to set verdict='pass', if any gate disagrees,
  // force verdict='fail' here. The validation above already rejects that case,
  // but this is a defense-in-depth reconciliation.
  const anyEthicsDisagreed = ETHICS_GATE_IDS.some(
    (g) => payload.ethicsGates?.[g] === 'disagree',
  );
  const finalVerdict: 'pass' | 'fail' = anyEthicsDisagreed ? 'fail' : payload.verdict;
  const ethicsAutoFailed = anyEthicsDisagreed;

  // ── Build merged rubric_scores JSONB ─────────────────────────────────────
  // Merge the submitted payload over any existing draft, then mark as final.
  const existing: Record<string, unknown> =
    (row.rubric_scores as Record<string, unknown> | null) ?? {};

  const mergedScores: Record<string, unknown> = {
    ...existing,
    sessionDeliveryDate:    payload.sessionDeliveryDate ?? existing['sessionDeliveryDate'],
    sessionNumber:          payload.sessionNumber       ?? existing['sessionNumber'],
    sessionLevel:           payload.sessionLevel        ?? existing['sessionLevel'],
    observations:           payload.observations,
    ethicsGates:            payload.ethicsGates,
    strongestCompetencies:  payload.strongestCompetencies,
    developmentAreas:       payload.developmentAreas,
    mentorGuidance:         payload.mentorGuidance,
    verdict:                finalVerdict,
    ethics_auto_failed:     ethicsAutoFailed,
    _submitted_at:          new Date().toISOString(),
  };

  const now = new Date().toISOString();

  // ── Atomic transaction: update assessment + advance instance state ─────────
  // withAdminContext wraps the callback in BEGIN/COMMIT/ROLLBACK automatically.
  await withAdminContext(async (db) => {
    // 1. Finalise the assessment row
    await db
      .update(packageAssessments)
      .set({
        decision:    finalVerdict,
        decided_at:  now,
        rubric_scores: mergedScores,
      })
      .where(eq(packageAssessments.id, assessmentId));

    // 2. Mark the recording as assessed
    await db
      .update(packageRecordings)
      .set({ status: 'assessed', updated_at: now })
      .where(eq(packageRecordings.id, row.recording_id));
  });

  // ── State machine transition (outside the DB transaction; non-blocking) ───
  // The transition writes to package_instances.journey_state.
  // State: under_assessment → assessment_passed | assessment_failed
  const targetState: JourneyState =
    finalVerdict === 'pass' ? 'assessment_passed' : 'assessment_failed';

  try {
    await transitionPackageState(row.package_instance_id, targetState, user.id);
  } catch (smErr) {
    // Log but don't fail the submission — the assessment is already committed.
    // A cron or admin retry can re-drive the state machine.
    console.error('[submit-assessment] state-machine transition failed:', smErr);
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  // admin_audit_log table exists (audit.ts). Log non-blocking.
  void logAdminAction({
    adminId:    user.id,
    action:     'SUBMIT_ASSESSMENT',
    targetType: 'package_assessment',
    targetId:   assessmentId,
    metadata:   {
      decision:           finalVerdict,
      ethics_auto_failed: ethicsAutoFailed,
      package_instance_id: row.package_instance_id,
    },
  });

  return NextResponse.json(
    {
      submitted_at: now,
      decision:     finalVerdict,
      ethics_auto_failed: ethicsAutoFailed,
    },
    { status: 200 },
  );
}
