/**
 * POST /api/admin/assessments/[assessmentId]/reassign
 *
 * Reassign a pending assessment from one assessor to another.
 *
 * Auth: role in ['admin', 'super_admin', 'mentor_manager']
 *
 * Body: {
 *   new_assessor_id: string,  // UUID — must be a profile with service_roles @> '{advanced_mentor}'
 *   reason: string,           // non-empty, required
 * }
 *
 * Pre-conditions:
 *   - assessment.decision === 'pending' (completed assessments cannot be reassigned)
 *   - new_assessor_id != current assessor_id (no-op guard returns 409)
 *   - new_assessor_id must correspond to an active advanced_mentor instructor
 *
 * Transaction (withAdminContext):
 *   1. UPDATE package_assessments SET assessor_id = new_assessor_id, assigned_at = NOW()
 *   2. Enqueue email to new assessor (reuses 'assessor-assignment' template)
 *   3. Enqueue email to old assessor (new 'assessor-reassigned' template)
 *
 * Audit: REASSIGN_ASSESSOR with { prior_assessor_id, new_assessor_id, reason }
 *
 * Phase: M5-ext — assessor reassignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, sql } from '@kunacademy/db';
import {
  packageAssessments,
  packageRecordings,
  packageInstances,
  profiles,
  instructors,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { logAdminAction } from '@kunacademy/db';
import { enqueueEmail } from '@/lib/email-outbox';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

interface ReassignBody {
  new_assessor_id: string;
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
    return NextResponse.json(
      { error: 'Forbidden — requires mentor_manager or admin role' },
      { status: 403 },
    );
  }

  // ── Parse + validate body ───────────────────────────────────────────────────
  let body: ReassignBody;
  try {
    body = (await request.json()) as ReassignBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  if (!body.new_assessor_id || typeof body.new_assessor_id !== 'string' || !UUID_RE.test(body.new_assessor_id)) {
    return NextResponse.json(
      { error: 'new_assessor_id must be a valid UUID' },
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
  const newAssessorId = body.new_assessor_id;

  // ── Validate new_assessor_id is an advanced_mentor ─────────────────────────
  // Assessors are instructors with service_roles @> ARRAY['advanced_mentor']
  // and a non-null profile_id.
  const assessorRows = await withAdminContext(async (db) => {
    return db
      .select({
        profile_id:  instructors.profile_id,
        full_name_ar: profiles.full_name_ar,
        full_name_en: profiles.full_name_en,
        email:       profiles.email,
        preferred_language: profiles.preferred_language,
      })
      .from(instructors)
      .innerJoin(profiles, eq(profiles.id, instructors.profile_id))
      .where(
        sql`${instructors.profile_id} = ${newAssessorId}::uuid
        AND ${instructors.service_roles} @> ARRAY['advanced_mentor']::text[]`,
      )
      .limit(1);
  });

  if (assessorRows.length === 0) {
    return NextResponse.json(
      {
        error: 'new_assessor_id does not match any active advanced_mentor instructor',
        error_ar: 'المُقيِّم الجديد غير مسجّل كمشرف متقدم في النظام',
      },
      { status: 400 },
    );
  }

  const newAssessor = assessorRows[0];

  // ── Load existing assessment ────────────────────────────────────────────────
  const assessmentRows = await withAdminContext(async (db) => {
    return db
      .select({
        id:                  packageAssessments.id,
        decision:            packageAssessments.decision,
        assessor_id:         packageAssessments.assessor_id,
        recording_id:        packageAssessments.recording_id,
        package_instance_id: packageRecordings.package_instance_id,
        original_filename:   packageRecordings.original_filename,
        submitted_at:        packageRecordings.submitted_at,
        duration_seconds:    packageRecordings.duration_seconds,
      })
      .from(packageAssessments)
      .innerJoin(packageRecordings, eq(packageRecordings.id, packageAssessments.recording_id))
      .where(eq(packageAssessments.id, assessmentId))
      .limit(1);
  });

  if (assessmentRows.length === 0) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  const existing = assessmentRows[0];

  // ── Pre-condition: only pending assessments can be reassigned ──────────────
  if (existing.decision !== 'pending') {
    return NextResponse.json(
      {
        error: `Cannot reassign a completed assessment (decision: ${existing.decision}). Only pending assessments can be reassigned.`,
        error_ar: `لا يمكن إعادة تعيين تقييم مكتمل (القرار: ${existing.decision}). يمكن إعادة تعيين التقييمات المعلقة فقط.`,
      },
      { status: 400 },
    );
  }

  // ── No-op guard: same assessor ─────────────────────────────────────────────
  if (existing.assessor_id === newAssessorId) {
    return NextResponse.json(
      {
        error: 'new_assessor_id is already the assigned assessor — no change made',
        error_ar: 'المُقيِّم الجديد هو نفس المُقيِّم الحالي — لم يتم إجراء أي تغيير',
      },
      { status: 409 },
    );
  }

  const priorAssessorId = existing.assessor_id;
  const now = new Date().toISOString();

  // ── Fetch old assessor profile for notification ────────────────────────────
  const oldAssessorRows = await withAdminContext(async (db) => {
    return db
      .select({
        email:              profiles.email,
        full_name_ar:       profiles.full_name_ar,
        full_name_en:       profiles.full_name_en,
        preferred_language: profiles.preferred_language,
      })
      .from(profiles)
      .where(eq(profiles.id, priorAssessorId))
      .limit(1);
  });

  // ── Fetch student profile for new-assessor notification ───────────────────
  const studentRows = await withAdminContext(async (db) => {
    return db
      .select({
        full_name_ar:       profiles.full_name_ar,
        full_name_en:       profiles.full_name_en,
        preferred_language: profiles.preferred_language,
      })
      .from(packageInstances)
      .innerJoin(profiles, eq(profiles.id, packageInstances.student_id))
      .where(eq(packageInstances.id, existing.package_instance_id))
      .limit(1);
  });

  // ── Atomic transaction: UPDATE + enqueue both emails ───────────────────────
  await withAdminContext(async (db) => {
    // 1. Reassign the assessor
    await db
      .update(packageAssessments)
      .set({
        assessor_id: newAssessorId,
        assigned_at: now,
      })
      .where(eq(packageAssessments.id, assessmentId));

    // 2. Enqueue email to NEW assessor (reuse 'assessor-assignment' template)
    const newAssessorLocale =
      (newAssessor.preferred_language === 'en' ? 'en' : 'ar') as 'ar' | 'en';
    const newAssessorName =
      newAssessorLocale === 'ar'
        ? (newAssessor.full_name_ar ?? newAssessor.full_name_en ?? '')
        : (newAssessor.full_name_en ?? newAssessor.full_name_ar ?? '');

    const student = studentRows[0];
    const studentName = student
      ? (newAssessorLocale === 'ar'
          ? (student.full_name_ar ?? student.full_name_en ?? null)
          : (student.full_name_en ?? student.full_name_ar ?? null))
      : null;

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kunacademy.com';
    const queueUrl = `${APP_URL}/${newAssessorLocale}/portal/assessor`;

    await enqueueEmail(db, {
      template_key: 'assessor-assignment',
      to_email:     newAssessor.email,
      payload:      {
        assessor_name:      newAssessorName,
        locale:             newAssessorLocale,
        student_name:       studentName,
        recording_filename: existing.original_filename ?? 'recording',
        duration_seconds:   existing.duration_seconds ?? null,
        submitted_at:       existing.submitted_at ?? now,
        queue_url:          queueUrl,
      },
    });

    // 3. Enqueue email to OLD assessor (new 'assessor-reassigned' template)
    if (oldAssessorRows.length > 0) {
      const oldAssessor = oldAssessorRows[0];
      const oldLocale =
        (oldAssessor.preferred_language === 'en' ? 'en' : 'ar') as 'ar' | 'en';
      const oldAssessorName =
        oldLocale === 'ar'
          ? (oldAssessor.full_name_ar ?? oldAssessor.full_name_en ?? '')
          : (oldAssessor.full_name_en ?? oldAssessor.full_name_ar ?? '');

      await enqueueEmail(db, {
        template_key: 'assessor-reassigned',
        to_email:     oldAssessor.email,
        payload:      {
          assessor_name: oldAssessorName,
          locale:        oldLocale,
        },
      });
    } else {
      console.warn(
        '[reassign-assessor] old assessor email skipped: profile not found for id',
        priorAssessorId,
      );
    }
  });

  // ── Audit log (non-blocking) ────────────────────────────────────────────────
  void logAdminAction({
    adminId:    user.id,
    action:     'REASSIGN_ASSESSOR',
    targetType: 'package_assessment',
    targetId:   assessmentId,
    metadata:   {
      prior_assessor_id: priorAssessorId,
      new_assessor_id:   newAssessorId,
      reason:            trimmedReason,
    },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(
    {
      reassigned_at:     now,
      prior_assessor_id: priorAssessorId,
      new_assessor_id:   newAssessorId,
    },
    { status: 200 },
  );
}
