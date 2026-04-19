import { pgTable, date, integer, jsonb, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { packageInstances } from './package-instances';

/**
 * beneficiary_files — one row per (package_instance × volunteer_client).
 *
 * Source: SPEC-mentoring-package-template.md §6.1 (first table block)
 * Sub-phase: S2-Layer-1 / 1.3
 *
 * The student's reflection workbook for each volunteer client IS the
 * mentor's prep material. One artifact, two audiences. (SPEC §6.2)
 *
 * client_number: STIC L1 has 2 volunteer clients. The CHECK (1,2) constraint
 * is enforced at the DB layer; the Drizzle schema reflects it in comments only.
 *
 * client_alias: student-provided pseudonym; NO real PII stored here.
 */
export const beneficiaryFiles = pgTable("beneficiary_files", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  package_instance_id: uuid("package_instance_id")
                         .notNull()
                         .references(() => packageInstances.id, { onDelete: 'cascade' }),

  /**
   * Which volunteer client (1 or 2).
   * CHECK (client_number IN (1, 2)) enforced in DB migration.
   */
  client_number:      integer("client_number").notNull(),

  /** Student-provided pseudonym for this client — no real PII. */
  client_alias:       text("client_alias"),

  /** Date the student first coached this volunteer client. */
  first_session_date: date("first_session_date"),

  /**
   * Phase 1.4: set by mentor-prep-release cron when the 48h gate opens.
   * NULL = prep materials not yet released to mentor.
   */
  mentor_prep_released_at: timestamp("mentor_prep_released_at", { withTimezone: true, mode: 'string' }),

  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => ({
  uniq_instance_client: unique("beneficiary_files_instance_client_uniq").on(
    table.package_instance_id,
    table.client_number,
  ),
}));

export type BeneficiaryFile    = typeof beneficiaryFiles.$inferSelect;
export type NewBeneficiaryFile = typeof beneficiaryFiles.$inferInsert;
