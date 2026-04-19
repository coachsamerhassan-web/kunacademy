import { pgTable, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { instructors } from './instructors';
import { packageTemplates } from './package-templates';
import { profiles } from './profiles';

/**
 * package_instances — one row per enrollment (template × student).
 *
 * Source: SPEC-mentoring-package-template.md §4.3
 * Sub-phase: S2-Layer-1 / 1.1
 *
 * student_id → profiles(id)  (locked decision Q4: no separate students table;
 *                              31 tables already FK to profiles.id)
 *
 * journey_state (16 values): see JOURNEY_STATES enum in enums.ts
 *
 * rubric_version_locked:
 *   Pinned at enrollment time from package_template.rubric_version.
 *   Ensures future rubric edits never retroactively change how this student
 *   was assessed. Null until enrollment fires.
 */
export const packageInstances = pgTable("package_instances", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  package_template_id: uuid("package_template_id").notNull().references(() => packageTemplates.id),
  /** FK to profiles(id) — students are profiles with role='student' */
  student_id:          uuid("student_id").notNull().references(() => profiles.id),
  assigned_mentor_id:  uuid("assigned_mentor_id").references(() => instructors.id),

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  enrolled_at:  timestamp("enrolled_at",  { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  /** = enrolled_at + validity_window_days; computed by enrollment service */
  expires_at:   timestamp("expires_at",   { withTimezone: true, mode: 'string' }).notNull(),
  completed_at: timestamp("completed_at", { withTimezone: true, mode: 'string' }),

  // ── Journey state machine ──────────────────────────────────────────────────
  /**
   * 16 valid states. CHECK constraint in DB; see JOURNEY_STATES enum.
   * Default: 'enrolled'
   */
  journey_state: text("journey_state").notNull().default('enrolled'),

  // ── Rubric version lock ────────────────────────────────────────────────────
  /** Pinned at enrollment from package_template.rubric_version */
  rubric_version_locked: integer("rubric_version_locked"),

  // ── Phase 1.4 additions ────────────────────────────────────────────────────
  /**
   * Deadline for second_try_pending → cron terminates after this date.
   * Set by admin when under_escalation → second_try_pending is triggered.
   */
  second_try_deadline_at: timestamp("second_try_deadline_at", { withTimezone: true, mode: 'string' }),

  /**
   * JSONB bag for cron deduplication flags.
   * Shape: {
   *   expiry_warned_14d?: ISO, expiry_warned_7d?: ISO, expiry_warned_1d?: ISO,
   *   second_try_warned_7d?: ISO, second_try_warned_3d?: ISO, second_try_warned_1d?: ISO,
   *   assessment_sla_notified_at?: ISO
   * }
   */
  cron_metadata: jsonb("cron_metadata").notNull().default({}),

  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export type PackageInstance    = typeof packageInstances.$inferSelect;
export type NewPackageInstance = typeof packageInstances.$inferInsert;
