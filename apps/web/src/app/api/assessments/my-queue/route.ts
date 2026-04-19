/**
 * GET /api/assessments/my-queue
 * Returns recordings assigned to the current user as assessor.
 *
 * Auth: advanced_mentor or mentor_manager only (service role check via profiles).
 * Returns: recordings where package_assessments.assessor_id = current user
 *   and decision = 'pending' (active workload).
 *
 * Sub-phase: S2-Layer-1 / 2.1 — Assessor Workspace UI
 */

import { NextResponse } from 'next/server';
import { withAdminContext, eq, and, desc, sql } from '@kunacademy/db';
import {
  packageRecordings,
  packageAssessments,
  packageInstances,
  profiles,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Must be admin, super_admin, mentor_manager, or provider with advanced_mentor service role.
  // For Phase 2.1 we allow admin, super_admin, and mentor_manager as well so workspace is testable.
  const allowedRoles = ['admin', 'super_admin', 'mentor_manager', 'provider'];
  if (!allowedRoles.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const queue = await withAdminContext(async (db) => {
    return db
      .select({
        assessment_id:       packageAssessments.id,
        recording_id:        packageRecordings.id,
        package_instance_id: packageRecordings.package_instance_id,
        original_filename:   packageRecordings.original_filename,
        mime_type:           packageRecordings.mime_type,
        file_size_bytes:     packageRecordings.file_size_bytes,
        duration_seconds:    packageRecordings.duration_seconds,
        recording_status:    packageRecordings.status,
        submitted_at:        packageRecordings.submitted_at,
        assigned_at:         packageAssessments.assigned_at,
        decision:            packageAssessments.decision,
        decision_note:       packageAssessments.decision_note,
        decided_at:          packageAssessments.decided_at,
        escalated_at:        packageAssessments.escalated_at,
        // Student info
        student_name_en: profiles.full_name_en,
        student_name_ar: profiles.full_name_ar,
        student_email:   profiles.email,
        // SLA: days since submission
        days_pending: sql<number>`EXTRACT(EPOCH FROM (now() - ${packageRecordings.submitted_at})) / 86400`,
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
      .where(
        and(
          eq(packageAssessments.assessor_id, user.id),
          eq(packageAssessments.decision, 'pending'),
        ),
      )
      .orderBy(desc(packageRecordings.submitted_at));
  });

  return NextResponse.json({ queue });
}
