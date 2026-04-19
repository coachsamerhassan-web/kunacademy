import { pgTable, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { packageRecordings } from './package-recordings';
import { profiles } from './profiles';

/**
 * package_assessments — one row per recording↔assessor assignment.
 *
 * Source: Phase 1.5 spec — Recording Submission + Assessor Assignment Queue
 * Sub-phase: S2-Layer-1 / 1.5
 *
 * decision machine:
 *   pending → pass | fail   (set by assessor)
 *   escalated_at populated by admin when escalation is triggered
 *
 * rubric_scores (JSONB) left null until Phase 2.x rubric integration.
 * Shape will be defined in SPEC-somatic-thinking-rubric-v1.md.
 */
export const packageAssessments = pgTable("package_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),

  recording_id: uuid("recording_id")
    .notNull()
    .references(() => packageRecordings.id, { onDelete: 'cascade' }),

  /**
   * Assessor must be an advanced mentor.
   * Enforced at application layer (assignAssessor checks service_roles).
   * FK to profiles(id) — assessors are profiled users.
   */
  assessor_id: uuid("assessor_id")
    .notNull()
    .references(() => profiles.id),

  assigned_at: timestamp("assigned_at", {
    withTimezone: true,
    mode: 'string',
  }).notNull().defaultNow(),

  /**
   * 'pending' → assessor working
   * 'pass'    → recording meets ICF/Somatic Thinking standard
   * 'fail'    → recording does not meet standard
   * CHECK enforced in DB migration.
   */
  decision: text("decision").notNull().default('pending'),

  /** Assessor's written feedback / notes. Required on fail. Optional on pass. */
  decision_note: text("decision_note"),

  /**
   * Phase 2.x rubric scores. Shape: { criteria: Array<{ id: string, score: number, note: string }> }
   * Null until rubric integration is built.
   */
  rubric_scores: jsonb("rubric_scores"),

  decided_at: timestamp("decided_at", {
    withTimezone: true,
    mode: 'string',
  }),

  /** Set by admin when the assessment is escalated for a second opinion. */
  escalated_at: timestamp("escalated_at", {
    withTimezone: true,
    mode: 'string',
  }),

  created_at: timestamp("created_at", {
    withTimezone: true,
    mode: 'string',
  }).notNull().defaultNow(),
});

export type PackageAssessment    = typeof packageAssessments.$inferSelect;
export type NewPackageAssessment = typeof packageAssessments.$inferInsert;
