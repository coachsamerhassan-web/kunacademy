import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, sql, desc } from '@kunacademy/db';
import {
  beneficiaryFileSessions,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

/**
 * GET /api/beneficiary-files/[id]/apprentice-view
 *
 * Apprentice-facing view of their OWN beneficiary file.
 *
 * Returns the file header, all sessions, and the latest package_assessment
 * (if any) tied to this file's package_instance — including rubric scores,
 * decision note, ethics_auto_failed flag, and voice-message id.
 *
 * ── Access logic ──────────────────────────────────────────────────────────
 *  Admin / super_admin → always granted.
 *  Apprentice owner    → granted (student_id on the package_instance).
 *  Everyone else       → 404 (NOT 403; see D1 spec — prefer privacy over
 *                        leaking that a file exists).
 *
 * ── Assessor-name redaction (D1 spec §4.1) ────────────────────────────────
 *  When the latest assessment.decision === 'fail', the assessor's name is
 *  replaced by the institutional label "مُقيّم كُن المعتمد" / "Kun Certified
 *  Assessor" so the apprentice sees the verdict without personalising it.
 *
 * Source: D1-APPRENTICE-BENEFICIARY-FILES-SPEC.md (Hakima, 2026-04-22)
 * Sub-phase: S2-Layer-1 / Wave D1
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FileRow {
  id:                   string;
  package_instance_id:  string;
  client_number:        number;
  client_alias:         string | null;
  first_session_date:   string | null;
  created_at:           string;
  updated_at:           string;
  student_id:           string;
  package_name_ar:      string;
  package_name_en:      string;
  journey_state:        string | null;
  second_try_deadline_at: string | null;
}

interface AssessmentRow {
  assessment_id:       string;
  decision:            string;
  decided_at:          string | null;
  decision_note:       string | null;
  ethics_auto_failed:  boolean;
  rubric_scores:       unknown;
  escalated_at:        string | null;
  override_reason:     string | null;
  override_by:         string | null;
  assessor_id:         string;
  assessor_name_ar:    string | null;
  assessor_name_en:    string | null;
  recording_id:        string;
  voice_message_id:    string | null;
  voice_duration:      number | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ── Fetch the file + package + journey context ──────────────────────────────
  const fileRow = await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      SELECT
        bf.id,
        bf.package_instance_id,
        bf.client_number,
        bf.client_alias,
        bf.first_session_date,
        bf.created_at,
        bf.updated_at,
        pi.student_id,
        pi.journey_state,
        pi.second_try_deadline_at,
        pt.name_ar  AS package_name_ar,
        pt.name_en  AS package_name_en
      FROM beneficiary_files bf
      JOIN package_instances  pi ON pi.id = bf.package_instance_id
      JOIN package_templates  pt ON pt.id = pi.package_template_id
      WHERE bf.id = ${id}
      LIMIT 1
    `);
    return (rows.rows[0] ?? null) as FileRow | null;
  });

  // Spec §6.4: prefer 404 over 403 when the row doesn't exist OR the caller
  // isn't authorised to see it — don't leak existence.
  if (!fileRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin    = user.role === 'admin' || user.role === 'super_admin';
  const isOwner    = fileRow.student_id === user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ── Fetch all sessions for this file ────────────────────────────────────────
  const sessions = await withAdminContext(async (db) => {
    return db
      .select()
      .from(beneficiaryFileSessions)
      .where(eq(beneficiaryFileSessions.beneficiary_file_id, id))
      .orderBy(beneficiaryFileSessions.session_number);
  });

  // ── Latest assessment on this package_instance (any recording) ─────────────
  // Apprentice view shows file-level feedback (not per-session). The most
  // recent decided assessment wins; if none is decided, show the most recent
  // pending one.
  const assessmentRow = await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      SELECT
        pa.id            AS assessment_id,
        pa.decision,
        pa.decided_at,
        pa.decision_note,
        pa.ethics_auto_failed,
        pa.rubric_scores,
        pa.escalated_at,
        pa.override_reason,
        pa.override_by,
        pa.assessor_id,
        p.full_name_ar   AS assessor_name_ar,
        p.full_name_en   AS assessor_name_en,
        pr.id            AS recording_id,
        vm.id            AS voice_message_id,
        vm.duration_seconds AS voice_duration
      FROM package_assessments pa
      JOIN package_recordings  pr ON pr.id = pa.recording_id
      LEFT JOIN profiles       p  ON p.id  = pa.assessor_id
      LEFT JOIN LATERAL (
        SELECT id, duration_seconds
        FROM assessment_voice_messages
        WHERE assessment_id = pa.id
        ORDER BY created_at DESC
        LIMIT 1
      ) vm ON true
      WHERE pr.package_instance_id = ${fileRow.package_instance_id}
      ORDER BY
        CASE WHEN pa.decided_at IS NULL THEN 1 ELSE 0 END,
        pa.decided_at DESC NULLS LAST,
        pa.created_at DESC
      LIMIT 1
    `);
    return (rows.rows[0] ?? null) as AssessmentRow | null;
  });

  // ── Assessor-name redaction (spec §4.1) ─────────────────────────────────────
  let assessorNameAr: string | null = null;
  let assessorNameEn: string | null = null;
  if (assessmentRow) {
    const isFail = assessmentRow.decision === 'fail';
    if (isFail) {
      assessorNameAr = 'مُقيّم كُن المعتمد';
      assessorNameEn = 'Kun Certified Assessor';
    } else {
      assessorNameAr = assessmentRow.assessor_name_ar;
      assessorNameEn = assessmentRow.assessor_name_en;
    }
  }

  return NextResponse.json({
    file: {
      id:                     fileRow.id,
      package_instance_id:    fileRow.package_instance_id,
      client_number:          fileRow.client_number,
      client_alias:           fileRow.client_alias,
      first_session_date:     fileRow.first_session_date,
      created_at:             fileRow.created_at,
      updated_at:             fileRow.updated_at,
      package_name_ar:        fileRow.package_name_ar,
      package_name_en:        fileRow.package_name_en,
      journey_state:          fileRow.journey_state,
      second_try_deadline_at: fileRow.second_try_deadline_at,
    },
    sessions,
    assessment: assessmentRow
      ? {
          id:                 assessmentRow.assessment_id,
          decision:           assessmentRow.decision,
          decided_at:         assessmentRow.decided_at,
          decision_note:      assessmentRow.decision_note,
          ethics_auto_failed: assessmentRow.ethics_auto_failed,
          rubric_scores:      assessmentRow.rubric_scores,
          escalated_at:       assessmentRow.escalated_at,
          override_reason:    assessmentRow.override_reason,
          has_override:       !!assessmentRow.override_by,
          assessor_name_ar:   assessorNameAr,
          assessor_name_en:   assessorNameEn,
          recording_id:       assessmentRow.recording_id,
        }
      : null,
    voice_message: assessmentRow?.voice_message_id
      ? {
          id:               assessmentRow.voice_message_id,
          duration_seconds: assessmentRow.voice_duration,
        }
      : null,
  });
}
