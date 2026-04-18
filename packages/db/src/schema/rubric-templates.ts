import { pgTable, boolean, integer, jsonb, text, timestamp, uuid, unique, primaryKey } from 'drizzle-orm/pg-core';
import { instructors } from './instructors';

/**
 * rubric_templates — versioned, immutable rubric definitions.
 *
 * Source: SPEC-somatic-thinking-rubric-v1.md §4.1
 * Sub-phase: S2-Layer-1 / 2.0
 *
 * Versioning rule:
 *   Rubric edits never mutate an existing published row.
 *   A new (id, version) row is written when structure changes.
 *   package_instances.rubric_version_locked pins the version at enrollment,
 *   so past assessments always read the rubric they were assessed against.
 *
 * Immutability:
 *   A BEFORE UPDATE trigger (trg_rubric_templates_immutability) raises
 *   integrity_constraint_violation if structural columns are modified on
 *   a published row. This is enforced at the DB layer independently of
 *   the application layer.
 *
 * RLS:
 *   Admin (BYPASSRLS): full access
 *   Assessors (advanced_mentor / mentor_manager): SELECT published only
 *   Everyone else: no access
 *
 * structure JSONB shape (from SPEC §3):
 *   {
 *     "parts": [
 *       {
 *         "id": "part-0",
 *         "label_ar": "...",
 *         "label_en": "...",
 *         "type": "metadata",
 *         "fields": [{ "id": "...", "label_ar": "...", "label_en": "...", "type": "text|date|radio" }]
 *       },
 *       {
 *         "id": "part-1",
 *         "label_ar": "...",
 *         "label_en": "...",
 *         "type": "observations",
 *         "subsections": [
 *           {
 *             "id": "1-1",
 *             "label_ar": "...",
 *             "label_en": "...",
 *             "conditional": false,
 *             "items": [{ "id": 1, "label_ar": "...", "label_en": "...", "requires_evidence": true }]
 *           }
 *         ]
 *       },
 *       {
 *         "id": "part-ethics",
 *         "label_ar": "...",
 *         "label_en": "...",
 *         "type": "ethics_gates",
 *         "items": [{ "id": "e1", "label_ar": "...", "label_en": "...", "auto_fail": true }]
 *       },
 *       {
 *         "id": "part-4",
 *         "label_ar": "...",
 *         "label_en": "...",
 *         "type": "summary",
 *         "fields": [{ "id": "...", "label_ar": "...", "label_en": "...", "type": "radio|textarea" }]
 *       }
 *     ]
 *   }
 */
export const rubricTemplates = pgTable("rubric_templates", {
  /**
   * Stable identifier for this rubric family.
   * e.g. 'somatic_thinking_level_1'
   * Combined with version forms the composite PK.
   */
  id: text("id").notNull(),

  /**
   * Monotonically increasing version number.
   * v1 = initial publish. v2 = new structure (old row preserved).
   */
  version: integer("version").notNull(),

  /**
   * Once true, structural columns are frozen by the DB trigger.
   * Assessor workspace only renders published rubrics.
   */
  published: boolean("published").notNull().default(false),

  title_ar:       text("title_ar").notNull(),
  title_en:       text("title_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),

  /**
   * Full rubric definition including all parts, items, ethics gates,
   * and summary fields. See shape documented above.
   */
  structure: jsonb("structure").notNull(),

  /** Instructor who created this rubric version. */
  created_by: uuid("created_by").references(() => instructors.id),

  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.version] }),
}));

export type RubricTemplate    = typeof rubricTemplates.$inferSelect;
export type NewRubricTemplate = typeof rubricTemplates.$inferInsert;
