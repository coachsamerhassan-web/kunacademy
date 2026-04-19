/**
 * GET /api/admin/assessments
 *
 * List assessments pending review or flagged for escalation.
 *
 * Auth: role in ['admin', 'super_admin', 'mentor_manager']
 *
 * Query params:
 *   ?status=pending|under_review|pass|fail  — filter by decision (default: pending+escalated)
 *   ?assessor_id=<uuid>                     — filter by assessor
 *   ?limit=<n>                              — max rows (default 50, max 200)
 *
 * Returns: { assessments: Array<EscalationListItem> }
 *
 * M5 — Mentor-manager escalation review UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'mentor_manager']);
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const VALID_STATUSES = new Set(['pending', 'under_review', 'pass', 'fail']);

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse query params ──────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);

  const statusParam = searchParams.get('status');
  const statusFilter = statusParam && VALID_STATUSES.has(statusParam) ? statusParam : null;

  const assessorIdParam = searchParams.get('assessor_id');
  const assessorFilter  = assessorIdParam && UUID_RE.test(assessorIdParam) ? assessorIdParam : null;

  const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(limitParam) || limitParam < 1
    ? DEFAULT_LIMIT
    : Math.min(limitParam, MAX_LIMIT);

  // ── Query ───────────────────────────────────────────────────────────────────
  const rows = await withAdminContext(async (db) => {
    // Build base query. We use parameterized sql`` template to stay safe.
    // Dynamic WHERE conditions are assembled using and() / separate branches.
    // The join shape is fixed; only the WHERE changes.

    if (statusFilter && assessorFilter) {
      const result = await db.execute(
        sql`SELECT
              pa.id                   AS assessment_id,
              pa.decision,
              pa.decided_at,
              pa.assigned_at,
              pa.escalated_at,
              pa.second_opinion_requested_at,
              pa.ethics_auto_failed,
              pa.override_reason,
              pr.id                   AS recording_id,
              pr.package_instance_id,
              pr.submitted_at,
              pr.original_filename,
              COALESCE(sp.full_name_en, sp.full_name_ar) AS student_name,
              sp.email                                   AS student_email,
              COALESCE(ap.full_name_en, ap.full_name_ar) AS assessor_name,
              ap.email                                   AS assessor_email
            FROM package_assessments pa
            INNER JOIN package_recordings pr ON pr.id = pa.recording_id
            INNER JOIN package_instances  pi ON pi.id = pr.package_instance_id
            INNER JOIN profiles           sp ON sp.id = pi.student_id
            INNER JOIN profiles           ap ON ap.id = pa.assessor_id
            WHERE pa.decision = ${statusFilter}
              AND pa.assessor_id = ${assessorFilter}::uuid
            ORDER BY pa.assigned_at DESC
            LIMIT ${limit}`
      );
      return result.rows;
    }

    if (statusFilter) {
      const result = await db.execute(
        sql`SELECT
              pa.id                   AS assessment_id,
              pa.decision,
              pa.decided_at,
              pa.assigned_at,
              pa.escalated_at,
              pa.second_opinion_requested_at,
              pa.ethics_auto_failed,
              pa.override_reason,
              pr.id                   AS recording_id,
              pr.package_instance_id,
              pr.submitted_at,
              pr.original_filename,
              COALESCE(sp.full_name_en, sp.full_name_ar) AS student_name,
              sp.email                                   AS student_email,
              COALESCE(ap.full_name_en, ap.full_name_ar) AS assessor_name,
              ap.email                                   AS assessor_email
            FROM package_assessments pa
            INNER JOIN package_recordings pr ON pr.id = pa.recording_id
            INNER JOIN package_instances  pi ON pi.id = pr.package_instance_id
            INNER JOIN profiles           sp ON sp.id = pi.student_id
            INNER JOIN profiles           ap ON ap.id = pa.assessor_id
            WHERE pa.decision = ${statusFilter}
            ORDER BY pa.assigned_at DESC
            LIMIT ${limit}`
      );
      return result.rows;
    }

    if (assessorFilter) {
      const result = await db.execute(
        sql`SELECT
              pa.id                   AS assessment_id,
              pa.decision,
              pa.decided_at,
              pa.assigned_at,
              pa.escalated_at,
              pa.second_opinion_requested_at,
              pa.ethics_auto_failed,
              pa.override_reason,
              pr.id                   AS recording_id,
              pr.package_instance_id,
              pr.submitted_at,
              pr.original_filename,
              COALESCE(sp.full_name_en, sp.full_name_ar) AS student_name,
              sp.email                                   AS student_email,
              COALESCE(ap.full_name_en, ap.full_name_ar) AS assessor_name,
              ap.email                                   AS assessor_email
            FROM package_assessments pa
            INNER JOIN package_recordings pr ON pr.id = pa.recording_id
            INNER JOIN package_instances  pi ON pi.id = pr.package_instance_id
            INNER JOIN profiles           sp ON sp.id = pi.student_id
            INNER JOIN profiles           ap ON ap.id = pa.assessor_id
            WHERE pa.assessor_id = ${assessorFilter}::uuid
              AND (pa.decision = 'pending' OR pa.escalated_at IS NOT NULL)
            ORDER BY pa.assigned_at DESC
            LIMIT ${limit}`
      );
      return result.rows;
    }

    // Default: pending decisions OR escalated rows (no assessor filter)
    const result = await db.execute(
      sql`SELECT
            pa.id                   AS assessment_id,
            pa.decision,
            pa.decided_at,
            pa.assigned_at,
            pa.escalated_at,
            pa.second_opinion_requested_at,
            pa.ethics_auto_failed,
            pa.override_reason,
            pr.id                   AS recording_id,
            pr.package_instance_id,
            pr.submitted_at,
            pr.original_filename,
            COALESCE(sp.full_name_en, sp.full_name_ar) AS student_name,
            sp.email                                   AS student_email,
            COALESCE(ap.full_name_en, ap.full_name_ar) AS assessor_name,
            ap.email                                   AS assessor_email
          FROM package_assessments pa
          INNER JOIN package_recordings pr ON pr.id = pa.recording_id
          INNER JOIN package_instances  pi ON pi.id = pr.package_instance_id
          INNER JOIN profiles           sp ON sp.id = pi.student_id
          INNER JOIN profiles           ap ON ap.id = pa.assessor_id
          WHERE (pa.decision = 'pending' OR pa.escalated_at IS NOT NULL)
          ORDER BY pa.assigned_at DESC
          LIMIT ${limit}`
    );
    return result.rows;
  });

  return NextResponse.json({ assessments: rows });
}
