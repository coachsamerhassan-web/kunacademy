/**
 * GET /api/packages/[instanceId]/assessment-result
 * Student-facing view of the most recent completed assessment for their package.
 *
 * Auth: session required.
 * Ownership: caller must be admin/super_admin/mentor_manager
 *   OR the student who owns the package instance.
 *   Assessors are explicitly EXCLUDED — they must use GET /api/assessments/[id].
 *
 * Returns:
 *   - package_instance fields: journey_state, second_try_deadline_at
 *   - Latest submitted assessment: decision, decided_at, rubric_scores,
 *     ethics_auto_failed, strongest_competencies, development_areas,
 *     mentor_guidance (Part 4 fields from rubric_scores JSONB)
 *   - Voice message id (if decision = 'fail' and a voice message exists)
 *
 * If no submitted assessment exists yet (still pending), returns
 *   { status: 'pending', decided_at: null } so the UI can show the in-progress state.
 *
 * Sub-phase: S2-Layer-1 / 2.8 — Student Result Page
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, desc, and } from '@kunacademy/db';
import {
  packageInstances,
  packageAssessments,
  packageRecordings,
  assessmentVoiceMessages,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shape of Part 4 fields stored inside rubric_scores JSONB
// (written by the assessor submit handler in Phase 2.7)
interface RubricScoresPart4 {
  strongest_competencies?: string;
  development_areas?: string;
  mentor_guidance?: string;
}

interface RouteContext {
  params: Promise<{ instanceId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { instanceId } = await context.params;

  if (!UUID_RE.test(instanceId)) {
    return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin =
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'mentor_manager';

  // ── Verify package instance + ownership ──────────────────────────────────────
  const instanceRow = await withAdminContext(async (db) => {
    const rows = await db
      .select({
        student_id:            packageInstances.student_id,
        journey_state:         packageInstances.journey_state,
        second_try_deadline_at: packageInstances.second_try_deadline_at,
        expires_at:            packageInstances.expires_at,
      })
      .from(packageInstances)
      .where(eq(packageInstances.id, instanceId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!instanceRow) {
    return NextResponse.json({ error: 'Package instance not found' }, { status: 404 });
  }

  // Assessors (provider role) are intentionally excluded — student + admin only
  const isStudent = !isAdmin && instanceRow.student_id === user.id;

  if (!isAdmin && !isStudent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Fetch most recent completed (decision != 'pending') assessment ────────────
  const assessmentRows = await withAdminContext(async (db) => {
    return db
      .select({
        assessment_id:      packageAssessments.id,
        decision:           packageAssessments.decision,
        decided_at:         packageAssessments.decided_at,
        rubric_scores:      packageAssessments.rubric_scores,
        ethics_auto_failed: packageAssessments.ethics_auto_failed,
        decision_note:      packageAssessments.decision_note,
      })
      .from(packageAssessments)
      .innerJoin(
        packageRecordings,
        eq(packageRecordings.id, packageAssessments.recording_id),
      )
      .where(
        and(
          eq(packageRecordings.package_instance_id, instanceId),
          // Only rows that have been submitted (decided_at not null = submitted)
        ),
      )
      .orderBy(desc(packageAssessments.decided_at))
      .limit(1);
  });

  // No completed assessment yet → in-progress state
  if (assessmentRows.length === 0 || !assessmentRows[0].decided_at) {
    return NextResponse.json({
      instance: {
        journey_state:          instanceRow.journey_state,
        second_try_deadline_at: instanceRow.second_try_deadline_at,
        expires_at:             instanceRow.expires_at,
      },
      assessment: null,
      voice_message: null,
    });
  }

  const a = assessmentRows[0];

  // ── Extract Part 4 fields from rubric_scores JSONB ────────────────────────────
  // rubric_scores shape written by Phase 2.7 submit handler.
  // Part 4 keys live at top level of the JSONB object.
  const part4 = (a.rubric_scores ?? {}) as RubricScoresPart4;

  // ── Fetch voice message (fail path only) ──────────────────────────────────────
  let voiceMessage: { id: string; duration_seconds: number | null } | null = null;

  if (a.decision === 'fail') {
    const vmRows = await withAdminContext(async (db) => {
      return db
        .select({
          id:               assessmentVoiceMessages.id,
          duration_seconds: assessmentVoiceMessages.duration_seconds,
        })
        .from(assessmentVoiceMessages)
        .where(eq(assessmentVoiceMessages.assessment_id, a.assessment_id))
        .orderBy(desc(assessmentVoiceMessages.created_at))
        .limit(1);
    });
    voiceMessage = vmRows[0] ?? null;
  }

  return NextResponse.json({
    instance: {
      journey_state:          instanceRow.journey_state,
      second_try_deadline_at: instanceRow.second_try_deadline_at,
      expires_at:             instanceRow.expires_at,
    },
    assessment: {
      id:                 a.assessment_id,
      decision:           a.decision,
      decided_at:         a.decided_at,
      ethics_auto_failed: a.ethics_auto_failed,
      decision_note:      a.decision_note,
      // Part 4 summary fields
      strongest_competencies: part4.strongest_competencies ?? null,
      development_areas:      part4.development_areas ?? null,
      mentor_guidance:        part4.mentor_guidance ?? null,
    },
    voice_message: voiceMessage,
  });
}
