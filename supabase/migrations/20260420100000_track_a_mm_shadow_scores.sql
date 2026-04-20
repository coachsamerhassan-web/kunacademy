-- Migration 0025 — Track A: MM Shadow Scores
-- Purpose: Adds assessment_mm_shadow_scores table so mentor-managers can score
--          independently before comparing with the assessor's rubric.
-- Phase: Track A (confirmation-bias fix — optional shadow review workflow)

CREATE TABLE IF NOT EXISTS assessment_mm_shadow_scores (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  UUID        NOT NULL REFERENCES package_assessments(id) ON DELETE CASCADE,
  reviewer_id    UUID        NOT NULL REFERENCES profiles(id),
  shadow_scores  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  agreement_notes TEXT,
  agreement_level TEXT        CHECK (agreement_level IN ('fully_agree', 'partially_agree', 'disagree')),
  submitted_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assessment_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS assessment_mm_shadow_scores_assessment_id_idx
  ON assessment_mm_shadow_scores(assessment_id);

-- App role (row-level access via RLS on parent tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON assessment_mm_shadow_scores TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON assessment_mm_shadow_scores TO kunacademy_admin;
