import { pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { milestoneLibrary } from './milestone-library';
import { packageInstances } from './package-instances';

/**
 * package_instance_milestones — per-enrollment milestone progress.
 *
 * Source: SPEC-mentoring-package-template.md §4.3 (second table block)
 * Sub-phase: S2-Layer-1 / 1.1
 *
 * Composite PK: (instance_id, milestone_library_id)
 * Auto-populated on enrollment for all required=true milestone_library rows.
 *
 * status (5 values): see MILESTONE_STATUS enum in enums.ts
 *
 * Override rules (§4.3):
 *   kun_student_bundled: assigned mentor is READ-ONLY except for mentor_note
 *   external_standalone: assigned mentor can INSERT, DELETE, or UPDATE due_at
 *   (Enforced at API layer + column-level grants on the DB; see migration notes)
 */
export const packageInstanceMilestones = pgTable("package_instance_milestones", {
  instance_id:          uuid("instance_id").notNull().references(() => packageInstances.id),
  milestone_library_id: uuid("milestone_library_id").notNull().references(() => milestoneLibrary.id),

  // ── Progress ───────────────────────────────────────────────────────────────
  /** CHECK: 'pending' | 'in_progress' | 'done' | 'stuck' | 'skipped' */
  status: text("status").notNull().default('pending'),

  // ── Notes ──────────────────────────────────────────────────────────────────
  /** Student's self-report commentary */
  student_note: text("student_note"),
  /** Mentor's reaction — the ONLY field writable by mentor in bundled context */
  mentor_note:  text("mentor_note"),

  // ── Timing ─────────────────────────────────────────────────────────────────
  /**
   * Computed at enrollment for enrollment_start anchors.
   * Null for future-anchored milestones until the upstream event fires.
   * Writable by mentor ONLY in external_standalone context.
   */
  due_at:       timestamp("due_at",       { withTimezone: true, mode: 'string' }),
  completed_at: timestamp("completed_at", { withTimezone: true, mode: 'string' }),

  // ── Audit ──────────────────────────────────────────────────────────────────
  /**
   * Distinguishes auto-applied (enrollment-time) milestones from manually-added
   * ones in the external_standalone flow.
   */
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.instance_id, table.milestone_library_id] }),
}));

export type PackageInstanceMilestone    = typeof packageInstanceMilestones.$inferSelect;
export type NewPackageInstanceMilestone = typeof packageInstanceMilestones.$inferInsert;
