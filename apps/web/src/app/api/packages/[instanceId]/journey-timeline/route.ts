/**
 * GET /api/packages/[instanceId]/journey-timeline
 * Student-facing journey timeline: audit log events + recording submission events.
 *
 * Auth: session required.
 * Ownership: caller must be admin/super_admin/mentor_manager OR the student who owns the instance.
 * Assessors (provider role) are explicitly excluded.
 *
 * Privacy: actor name is NEVER returned for OVERRIDE_ASSESSMENT_DECISION or
 * OVERRIDE_AUTO_UNPAUSE actions — students only see "Mentor manager".
 *
 * Returns events ordered ASC (oldest first) so the UI can render top→bottom.
 *
 * Sub-phase: S2-Layer-1 / 2.9 — Student Journey Timeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, eq } from '@kunacademy/db';
import {
  packageInstances,
  packageRecordings,
} from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Actions we surface to students */
const JOURNEY_ACTIONS = [
  'SUBMIT_ASSESSMENT',
  'PAUSE_JOURNEY',
  'UNPAUSE_JOURNEY',
  'OVERRIDE_ASSESSMENT_DECISION',
  'OVERRIDE_AUTO_UNPAUSE',
] as const;

/** Actions where the actor name is hidden from students */
const ANONYMOUS_ACTIONS = new Set(['OVERRIDE_ASSESSMENT_DECISION', 'OVERRIDE_AUTO_UNPAUSE']);

export interface JourneyEvent {
  id: string;
  event_type: 'audit' | 'recording';
  action: string;
  occurred_at: string;
  /** Only present for override actions — truncated at 200 chars, PII stripped */
  override_reason?: string;
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

  // ── Verify instance + ownership ──────────────────────────────────────────────
  const instanceRow = await withAdminContext(async (db) => {
    const rows = await db
      .select({ student_id: packageInstances.student_id, enrolled_at: packageInstances.enrolled_at })
      .from(packageInstances)
      .where(eq(packageInstances.id, instanceId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!instanceRow) {
    return NextResponse.json({ error: 'Package instance not found' }, { status: 404 });
  }

  const isStudent = !isAdmin && instanceRow.student_id === user.id;
  if (!isAdmin && !isStudent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Fetch audit events for this instance ─────────────────────────────────────
  // We match on target_id = instanceId (for PAUSE/UNPAUSE/OVERRIDE actions)
  // AND target_id IN (assessmentIds for this instance) for SUBMIT_ASSESSMENT.
  // We do a single query: target_id = instanceId OR target_id IN (SELECT id FROM package_assessments ...)
  const auditRows = await withAdminContext(async (db) => {
    return db.execute(sql`
      SELECT
        aal.id,
        aal.action,
        aal.target_id,
        aal.metadata,
        aal.created_at
      FROM admin_audit_log aal
      WHERE
        aal.action = ANY(ARRAY[${sql.raw(JOURNEY_ACTIONS.map(a => `'${a}'`).join(','))}]::text[])
        AND (
          aal.target_id = ${instanceId}
          OR aal.target_id IN (
            SELECT pa.id
            FROM package_assessments pa
            INNER JOIN package_recordings pr ON pa.recording_id = pr.id
            WHERE pr.package_instance_id = ${instanceId}
          )
        )
      ORDER BY aal.created_at ASC
    `);
  });

  // ── Fetch recording submission events ────────────────────────────────────────
  const recordingRows = await withAdminContext(async (db) => {
    return db
      .select({
        id:           packageRecordings.id,
        submitted_at: packageRecordings.submitted_at,
      })
      .from(packageRecordings)
      .where(eq(packageRecordings.package_instance_id, instanceId))
      .orderBy(packageRecordings.submitted_at);
  });

  // ── Synthesise events list ───────────────────────────────────────────────────

  const events: JourneyEvent[] = [];

  // "Enrolled" synthetic event from instance itself
  events.push({
    id:           `enrolled-${instanceId}`,
    event_type:   'audit',
    action:       'ENROLLED',
    occurred_at:  instanceRow.enrolled_at,
  });

  // Recording submitted events
  for (const rec of recordingRows) {
    events.push({
      id:          `recording-${rec.id}`,
      event_type:  'recording',
      action:      'RECORDING_SUBMITTED',
      occurred_at: rec.submitted_at,
    });
  }

  // Audit events
  for (const row of (auditRows.rows as Array<{
    id: string;
    action: string;
    target_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>)) {
    const event: JourneyEvent = {
      id:          row.id,
      event_type:  'audit',
      action:      row.action,
      occurred_at: row.created_at,
    };

    // For override actions: surface reason (truncated), never actor name
    if (ANONYMOUS_ACTIONS.has(row.action)) {
      const reason = row.metadata?.override_reason;
      if (typeof reason === 'string' && reason.length > 0) {
        // Truncate at 200 chars to prevent long PII-like strings from leaking
        event.override_reason = reason.slice(0, 200);
      }
    }

    events.push(event);
  }

  // Sort all events by occurred_at ASC
  events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  return NextResponse.json({ events });
}
