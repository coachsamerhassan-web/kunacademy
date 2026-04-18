import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq, sql } from '@kunacademy/db';
import { beneficiaryFiles, beneficiaryFileSessions, packageInstances } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

/**
 * GET /api/beneficiary-files/[id]/mentor-view
 *
 * Returns a beneficiary file + all its sessions for the assigned mentor,
 * subject to the 48-hour pre-session access gate (SPEC §6.2 + cron #9).
 *
 * ── Access logic ───────────────────────────────────────────────────────────
 *
 *  Admin        → always granted, no time gate
 *  Assigned mentor →
 *    If `next_session_at` query param is provided by the cron/caller:
 *      • now < (next_session_at − 48h) AND no sessions completed yet → 403
 *        with { locked_until: ISO_TIMESTAMP }
 *      • otherwise → 200 + full payload
 *    If `next_session_at` is absent (e.g. all sessions done, post-session audit):
 *      → always 200 (indefinite read access post-completion per SPEC §6.2)
 *  Anyone else  → 403
 *
 * ── Why next_session_at is a query param, not DB-derived ──────────────────
 *
 *  The `mentoring_sessions` scheduling table (with `scheduled_at`) is Phase 1.4
 *  (state machine + cron wire-up). Phase 1.6 ships the access-gate logic and UI;
 *  Phase 1.4 wires the cron that will call this endpoint with the correct
 *  next_session_at. Until then, callers pass the param explicitly.
 *
 *  When Phase 1.4 lands, the cron (#9 `mentor_prep_release`) will:
 *    1. Query the upcoming mentoring booking for the package_instance
 *    2. Call this endpoint with ?next_session_at=<ISO> to verify access
 *    3. If 200, send the mentor prep email via sendMentorPrepEmail()
 *
 * Source: SPEC-mentoring-package-template.md §6.2 + §9 (cron #9)
 * Sub-phase: S2-Layer-1 / 1.6
 */

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

interface DbFileRow {
  id:                  string;
  package_instance_id: string;
  client_number:       number;
  client_alias:        string | null;
  first_session_date:  string | null;
  created_at:          string;
  updated_at:          string;
  student_id:          string;
  assigned_mentor_id:  string | null;
  package_name_ar:     string;
  package_name_en:     string;
  // Instructor row for mentor identity check
  instructor_id:       string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // ── Fetch the file + package context ────────────────────────────────────────
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
        pi.assigned_mentor_id,
        pt.name_ar  AS package_name_ar,
        pt.name_en  AS package_name_en,
        i.id        AS instructor_id
      FROM beneficiary_files bf
      JOIN package_instances  pi ON pi.id = bf.package_instance_id
      JOIN package_templates  pt ON pt.id = pi.package_template_id
      LEFT JOIN instructors   i  ON i.id  = pi.assigned_mentor_id
                                 AND i.profile_id = ${user.id}
      WHERE bf.id = ${id}
      LIMIT 1
    `);
    return (rows.rows[0] ?? null) as DbFileRow | null;
  });

  if (!fileRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin  = user.role === 'admin' || user.role === 'super_admin';
  // instructor_id is non-null only when profile_id matched — so this is the mentor check
  const isMentor = fileRow.instructor_id !== null;

  if (!isAdmin && !isMentor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── 48-hour gate (mentors only; admins bypass) ───────────────────────────────
  if (!isAdmin) {
    const nextSessionParam = request.nextUrl.searchParams.get('next_session_at');

    if (nextSessionParam) {
      const nextSessionMs = Date.parse(nextSessionParam);
      if (isNaN(nextSessionMs)) {
        return NextResponse.json(
          { error: 'next_session_at must be a valid ISO timestamp' },
          { status: 400 },
        );
      }

      const now = Date.now();
      const lockedUntilMs = nextSessionMs - FORTY_EIGHT_HOURS_MS;

      // Check whether any session has already been completed (status = 'reviewed')
      const completedRows = await withAdminContext(async (db) => {
        return db
          .select({ status: beneficiaryFileSessions.status })
          .from(beneficiaryFileSessions)
          .where(eq(beneficiaryFileSessions.beneficiary_file_id, id))
          .limit(3);
      });
      const hasCompleted = (completedRows as Array<{ status: string }>).some(
        (row) => row.status === 'reviewed',
      );

      // Gate: locked if now < lockedUntil AND no sessions completed yet
      if (now < lockedUntilMs && !hasCompleted) {
        return NextResponse.json(
          {
            error:        'Prep materials not yet available',
            locked_until: new Date(lockedUntilMs).toISOString(),
          },
          { status: 403 },
        );
      }
    }
    // If next_session_at is absent: post-session audit mode — always allow (SPEC §6.2)
  }

  // ── Fetch all sessions for this file ────────────────────────────────────────
  const sessions = await withAdminContext(async (db) => {
    return db
      .select()
      .from(beneficiaryFileSessions)
      .where(eq(beneficiaryFileSessions.beneficiary_file_id, id))
      .orderBy(beneficiaryFileSessions.session_number);
  });

  return NextResponse.json({
    file: {
      id:                  fileRow.id,
      package_instance_id: fileRow.package_instance_id,
      client_number:       fileRow.client_number,
      client_alias:        fileRow.client_alias,
      first_session_date:  fileRow.first_session_date,
      created_at:          fileRow.created_at,
      updated_at:          fileRow.updated_at,
      package_name_ar:     fileRow.package_name_ar,
      package_name_en:     fileRow.package_name_en,
    },
    sessions,
  });
}
