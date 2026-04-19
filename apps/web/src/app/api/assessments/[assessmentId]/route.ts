/**
 * GET /api/assessments/[assessmentId]
 * Fetch a single assessment assignment with its recording metadata.
 *
 * Auth: assessor must own this assessment (assessor_id = current user)
 *   OR admin/super_admin/mentor_manager.
 *
 * Sub-phase: S2-Layer-1 / 2.1 — Assessor Workspace UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, and } from '@kunacademy/db';
import {
  packageRecordings,
  packageAssessments,
  packageInstances,
  profiles,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { assessmentId } = await context.params;

  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessmentId' }, { status: 400 });
  }

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'mentor_manager';

  // Fetch the assessment row first to confirm ownership
  const rows = await withAdminContext(async (db) => {
    return db
      .select({
        assessment_id:       packageAssessments.id,
        recording_id:        packageRecordings.id,
        package_instance_id: packageRecordings.package_instance_id,
        assessor_id:         packageAssessments.assessor_id,
        decision:            packageAssessments.decision,
        decision_note:       packageAssessments.decision_note,
        decided_at:          packageAssessments.decided_at,
        assigned_at:         packageAssessments.assigned_at,
        escalated_at:        packageAssessments.escalated_at,
        rubric_scores:       packageAssessments.rubric_scores,
        ethics_auto_failed:  packageAssessments.ethics_auto_failed,
        // Recording fields
        original_filename:   packageRecordings.original_filename,
        mime_type:           packageRecordings.mime_type,
        file_size_bytes:     packageRecordings.file_size_bytes,
        duration_seconds:    packageRecordings.duration_seconds,
        recording_status:    packageRecordings.status,
        submitted_at:        packageRecordings.submitted_at,
        // Student info
        student_name_en: profiles.full_name_en,
        student_name_ar: profiles.full_name_ar,
        student_email:   profiles.email,
        // Package instance state (needed for unpause button)
        journey_state:   packageInstances.journey_state,
      })
      .from(packageAssessments)
      .innerJoin(
        packageRecordings,
        eq(packageRecordings.id, packageAssessments.recording_id),
      )
      .innerJoin(
        packageInstances,
        eq(packageInstances.id, packageRecordings.package_instance_id),
      )
      .innerJoin(
        profiles,
        eq(profiles.id, packageInstances.student_id),
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

  return NextResponse.json({ assessment: row });
}
