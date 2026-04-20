-- Migration 0028: per-course certificate eligibility gate config
-- Default values preserve existing behavior (100% completion + all quizzes required)

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS min_completion_pct INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS require_quiz_pass BOOLEAN NOT NULL DEFAULT true;

-- Sanity CHECK: min_completion_pct ∈ [0, 100]
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'courses_min_completion_pct_range'
  ) THEN
    ALTER TABLE courses ADD CONSTRAINT courses_min_completion_pct_range
      CHECK (min_completion_pct BETWEEN 0 AND 100);
  END IF;
END $$;
