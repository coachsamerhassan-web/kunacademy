-- Migration 0020: Promote ethics_auto_failed from JSONB to proper DB column
-- Ref: SPEC-somatic-thinking-rubric-v1.md §5.5
-- Sub-phase: S2-Layer-1 / 2.7

-- Add column (idempotent via IF NOT EXISTS)
ALTER TABLE package_assessments
  ADD COLUMN IF NOT EXISTS ethics_auto_failed BOOLEAN NOT NULL DEFAULT FALSE;

-- CHECK constraint: if ethics_auto_failed = true, decision must be 'fail' or still 'pending'
-- (pending covers the window between column write and a possible admin reopen)
ALTER TABLE package_assessments
  ADD CONSTRAINT ethics_autofail_implies_fail
    CHECK (ethics_auto_failed = FALSE OR decision IN ('pending', 'fail'));

-- Grants — kunacademy is the app role; kunacademy_admin is the BYPASSRLS admin role
GRANT SELECT, INSERT, UPDATE ON package_assessments TO kunacademy, kunacademy_admin;
