/**
 * GET /api/assessments/queue
 * Returns all recordings currently under_review with assessor info and days_pending.
 *
 * Auth: admin or mentor_manager only.
 * Sub-phase: S2-Layer-1 / 1.5
 */

import { NextResponse } from 'next/server';
import { withAdminContext, eq, desc, sql } from '@kunacademy/db';
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

  if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'mentor_manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const queue = await withAdminContext(async (db) => {
    return db
      .select({
        recording_id:        packageRecordings.id,
        package_instance_id: packageRecordings.package_instance_id,
        original_filename:   packageRecordings.original_filename,
        mime_type:           packageRecordings.mime_type,
        file_size_bytes:     packageRecordings.file_size_bytes,
        duration_seconds:    packageRecordings.duration_seconds,
        submitted_at:        packageRecordings.submitted_at,
        recording_status:    packageRecordings.status,

        // Assessor info
        assessment_id:     packageAssessments.id,
        assessor_id:       packageAssessments.assessor_id,
        assigned_at:       packageAssessments.assigned_at,
        decision:          packageAssessments.decision,
        escalated_at:      packageAssessments.escalated_at,
        assessor_name:     profiles.full_name_en,
        assessor_name_ar:  profiles.full_name_ar,
        assessor_email:    profiles.email,

        // days_pending: computed from submitted_at
        days_pending: sql<number>`EXTRACT(EPOCH FROM (now() - ${packageRecordings.submitted_at})) / 86400`,
      })
      .from(packageRecordings)
      .innerJoin(
        packageAssessments,
        eq(packageAssessments.recording_id, packageRecordings.id),
      )
      .innerJoin(
        profiles,
        eq(profiles.id, packageAssessments.assessor_id),
      )
      .where(eq(packageRecordings.status, 'under_review'))
      .orderBy(desc(packageRecordings.submitted_at));
  });

  return NextResponse.json({ queue });
}
