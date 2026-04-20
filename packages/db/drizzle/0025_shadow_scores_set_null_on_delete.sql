-- 0025: shadow scores survive assessment deletion for audit integrity
-- DeepSeek HIGH: audit log rows for OVERRIDE_ASSESSMENT_DECISION stored shadow_score_id
-- which became a dangling reference after CASCADE delete of assessment_mm_shadow_scores.
-- Fix: change FK to SET NULL so shadow rows survive as orphans (assessment_id = NULL)
-- when the parent assessment is deleted. Audit snapshot in metadata is primary evidence;
-- orphan shadow rows are belt-and-suspenders secondary evidence.

ALTER TABLE assessment_mm_shadow_scores
  DROP CONSTRAINT IF EXISTS assessment_mm_shadow_scores_assessment_id_fkey;

ALTER TABLE assessment_mm_shadow_scores
  ALTER COLUMN assessment_id DROP NOT NULL;

ALTER TABLE assessment_mm_shadow_scores
  ADD CONSTRAINT assessment_mm_shadow_scores_assessment_id_fkey
  FOREIGN KEY (assessment_id)
  REFERENCES package_assessments(id)
  ON DELETE SET NULL;
