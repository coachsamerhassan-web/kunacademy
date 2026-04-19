/**
 * assignAssessor — round-robin advanced-mentor assignment for recording assessments.
 *
 * Sub-phase: S2-Layer-1 / 1.5
 *
 * Algorithm:
 *   1. Load the package instance to find assigned_mentor_id (to skip self-assessment).
 *   2. Query instructors with service_roles @> '{advanced_mentor}'.
 *   3. Join with assessor_assignment_tracker, order by last_assigned_at ASC NULLS FIRST
 *      so never-assigned assessors get priority.
 *   4. Skip the candidate if their profile_id matches the package's assigned_mentor_id.
 *   5. Create a package_assessments row and upsert the tracker timestamp.
 *   6. Update package_recordings.status → 'under_review'.
 *
 * Throws if no eligible assessor is found.
 */

import { withAdminContext, eq, asc, isNull, sql } from '@kunacademy/db';
import {
  packageInstances,
  instructors,
  assessorAssignmentTracker,
  packageAssessments,
  packageRecordings,
} from '@kunacademy/db/schema';

interface AssessorRow {
  profile_id: string | null;
  last_assigned_at: string | null;
}

interface CandidateRow {
  instructor_assessor_id: string;   // instructors.id (not used for FK — we need profile_id)
  profile_id: string | null;
  last_assigned_at: string | null;
}

/**
 * Assign an advanced mentor assessor to a recording using round-robin.
 * Must be called after the package_recordings row is created.
 *
 * @param recordingId       — UUID of the new package_recordings row
 * @param packageInstanceId — UUID of the package instance that owns this recording
 * @returns                   The profile_id of the assigned assessor
 * @throws                    Error if no eligible advanced mentor exists
 */
export async function assignAssessor(
  recordingId: string,
  packageInstanceId: string,
): Promise<string> {
  return withAdminContext(async (db) => {
    // ── Step 1: Get the assigned mentor's profile_id to exclude ────────────────
    const instanceRows = await db
      .select({
        assigned_mentor_id: packageInstances.assigned_mentor_id,
      })
      .from(packageInstances)
      .where(eq(packageInstances.id, packageInstanceId))
      .limit(1);

    const instance = instanceRows[0];
    if (!instance) {
      throw new Error(`Package instance not found: ${packageInstanceId}`);
    }

    // Resolve the mentor's profile_id (to compare against assessor candidates)
    let assignedMentorProfileId: string | null = null;
    if (instance.assigned_mentor_id) {
      const mentorRows = await db
        .select({ profile_id: instructors.profile_id })
        .from(instructors)
        .where(eq(instructors.id, instance.assigned_mentor_id))
        .limit(1);
      assignedMentorProfileId = mentorRows[0]?.profile_id ?? null;
    }

    // ── Step 2+3: Lock tracker rows to prevent concurrent double-assignment ─────
    // withAdminContext runs inside a single BEGIN/COMMIT transaction (see pool.ts).
    // SELECT ... FOR UPDATE SKIP LOCKED on the tracker table ensures that if two
    // concurrent requests race here, the second request skips the rows already
    // locked by the first and will pick the next eligible assessor — preserving
    // round-robin fairness without deadlocks.
    await db.execute(
      sql`SELECT assessor_id FROM ${assessorAssignmentTracker} FOR UPDATE SKIP LOCKED`,
    );

    // LEFT JOIN assessor_assignment_tracker so that assessors who have never been
    // assigned (no tracker row) appear first (NULL sorts first with NULLS FIRST).
    const candidates: CandidateRow[] = await db
      .select({
        instructor_assessor_id: instructors.id,
        profile_id: instructors.profile_id,
        last_assigned_at: assessorAssignmentTracker.last_assigned_at,
      })
      .from(instructors)
      .leftJoin(
        assessorAssignmentTracker,
        // Join on assessor_assignment_tracker.assessor_id = instructors.profile_id
        // We compare UUIDs as text since both are uuid columns
        sql`${assessorAssignmentTracker.assessor_id} = ${instructors.profile_id}`,
      )
      .where(
        // service_roles @> ARRAY['advanced_mentor'] — Postgres array contains operator
        sql`${instructors.service_roles} @> ARRAY['advanced_mentor']::text[]`,
      )
      .orderBy(
        // NULLS FIRST: never-assigned assessors get priority
        sql`${assessorAssignmentTracker.last_assigned_at} ASC NULLS FIRST`,
      );

    if (candidates.length === 0) {
      throw new Error('No advanced mentor assessors are configured in the system.');
    }

    // ── Step 4: Skip assessor if they are the student's own assigned mentor ────
    const eligible = candidates.find(
      (c) =>
        c.profile_id !== null &&
        c.profile_id !== assignedMentorProfileId,
    );

    if (!eligible) {
      throw new Error(
        'No eligible advanced mentor assessor found (all candidates are the student\'s own mentor).',
      );
    }

    const assessorProfileId = eligible.profile_id!;

    // ── Step 5a: Create the package_assessments row ────────────────────────────
    await db
      .insert(packageAssessments)
      .values({
        recording_id: recordingId,
        assessor_id:  assessorProfileId,
      });

    // ── Step 5b: Upsert the assessor tracker timestamp ─────────────────────────
    // INSERT ... ON CONFLICT (assessor_id) DO UPDATE
    await db
      .insert(assessorAssignmentTracker)
      .values({
        assessor_id:      assessorProfileId,
        last_assigned_at: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: assessorAssignmentTracker.assessor_id,
        set: {
          last_assigned_at: new Date().toISOString(),
        },
      });

    // ── Step 6: Transition recording status → 'under_review' ──────────────────
    await db
      .update(packageRecordings)
      .set({ status: 'under_review', updated_at: new Date().toISOString() })
      .where(eq(packageRecordings.id, recordingId));

    return assessorProfileId;
  });
}
