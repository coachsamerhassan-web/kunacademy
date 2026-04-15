import { pgTable, boolean, integer, jsonb, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { packageTemplates } from './package-templates';

/**
 * milestone_library — milestones associated with a package template.
 *
 * Source: SPEC-mentoring-package-template.md §4.2
 * Sub-phase: S2-Layer-1 / 1.1
 *
 * Curation rules (enforced via RLS + kun.can_perform):
 *   kun_student_bundled context → only mentor_manager can CREATE / UPDATE / DELETE
 *   external_standalone context → any mentor_coach or above can seed defaults
 *
 * anchor_event values (9): see ANCHOR_EVENTS enum in enums.ts
 */
export const milestoneLibrary = pgTable("milestone_library", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  package_template_id: uuid("package_template_id").notNull().references(() => packageTemplates.id),

  // ── Identity ───────────────────────────────────────────────────────────────
  /** Stable display code, e.g. 'M1.a', 'M2.c' — unique within a template */
  code:           text("code").notNull(),
  title_ar:       text("title_ar").notNull(),
  title_en:       text("title_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),

  // ── Anchoring ──────────────────────────────────────────────────────────────
  /**
   * CHECK: one of 9 anchor_event values.
   * See ANCHOR_EVENTS in enums.ts for the full tuple.
   */
  anchor_event:    text("anchor_event").notNull(),
  /**
   * Days after anchor_event when milestone is due.
   * 0 = immediately on event; null = no due date.
   */
  due_offset_days: integer("due_offset_days"),

  // ── Regime ─────────────────────────────────────────────────────────────────
  required:      boolean("required").notNull().default(true),
  display_order: integer("display_order").notNull(),

  // ── Optional metadata ──────────────────────────────────────────────────────
  /** e.g. resource links, video URLs */
  metadata: jsonb("metadata"),

  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => ({
  uniq_template_code: unique("milestone_library_template_code_uniq").on(
    table.package_template_id,
    table.code,
  ),
}));

export type MilestoneLibrary    = typeof milestoneLibrary.$inferSelect;
export type NewMilestoneLibrary = typeof milestoneLibrary.$inferInsert;
