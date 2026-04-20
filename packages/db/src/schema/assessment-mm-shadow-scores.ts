import { pgTable, uuid, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { packageAssessments } from './package-assessments';
import { profiles } from './profiles';

/**
 * assessment_mm_shadow_scores — one row per (assessment, reviewer).
 *
 * Created by Track A to support the side-by-side comparison view where a
 * mentor-manager fills in their own rubric BEFORE viewing the assessor's work.
 * This eliminates confirmation bias from the override workflow.
 *
 * Visibility rules (enforced in API layer):
 *   - Only the reviewer (reviewer_id) OR admin/super_admin may read this row.
 *   - Assessors never see it.
 *   - Students never see it.
 *
 * shadow_scores shape mirrors package_assessments.rubric_scores:
 *   { observations?: Record<string, { state, evidence }>, ethicsGates?, ... }
 */
export const assessmentMmShadowScores = pgTable('assessment_mm_shadow_scores', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Nullable: SET NULL when parent assessment is deleted, preserving shadow row
  // as orphan evidence. Audit snapshot in OVERRIDE_ASSESSMENT_DECISION metadata
  // is the primary immutable record; orphan row is belt-and-suspenders.
  assessment_id: uuid('assessment_id')
    .references(() => packageAssessments.id, { onDelete: 'set null' }),

  reviewer_id: uuid('reviewer_id')
    .notNull()
    .references(() => profiles.id),

  /**
   * Manager's independent rubric scores — same shape as assessor's rubric_scores.
   * Deep-merged on each auto-save PUT (never overwritten wholesale).
   */
  shadow_scores: jsonb('shadow_scores').notNull().default('{}'),

  /** Optional free-text justification for the agreement level chosen. */
  agreement_notes: text('agreement_notes'),

  /**
   * Manager's overall agreement with the assessor after comparison.
   * CHECK constraint in migration enforces the enum.
   */
  agreement_level: text('agreement_level'),

  /** Set when the manager submits. NULL = shadow in progress (auto-saved only). */
  submitted_at: timestamp('submitted_at', { withTimezone: true, mode: 'string' }),

  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),

  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export type AssessmentMmShadowScore    = typeof assessmentMmShadowScores.$inferSelect;
export type NewAssessmentMmShadowScore = typeof assessmentMmShadowScores.$inferInsert;
