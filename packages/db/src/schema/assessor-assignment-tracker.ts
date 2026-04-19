import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * assessor_assignment_tracker — tracks the last time each assessor was assigned
 * a recording, enabling true round-robin distribution.
 *
 * Source: Phase 1.5 spec — Recording Submission + Assessor Assignment Queue
 * Sub-phase: S2-Layer-1 / 1.5
 *
 * One row per assessor. Upserted (INSERT ... ON CONFLICT DO UPDATE) each time
 * an assessor receives an assignment. Ordered ASC NULLS FIRST to give
 * never-assigned assessors priority.
 */
export const assessorAssignmentTracker = pgTable("assessor_assignment_tracker", {
  /**
   * PK is the assessor's profile id — one row per assessor.
   * Must have service_roles containing 'advanced_mentor'.
   */
  assessor_id: uuid("assessor_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),

  last_assigned_at: timestamp("last_assigned_at", {
    withTimezone: true,
    mode: 'string',
  }),
});

export type AssessorAssignmentTracker    = typeof assessorAssignmentTracker.$inferSelect;
export type NewAssessorAssignmentTracker = typeof assessorAssignmentTracker.$inferInsert;
