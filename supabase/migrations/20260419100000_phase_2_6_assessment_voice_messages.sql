-- Migration: Phase 2.6 — assessment_voice_messages
-- Adds the table that stores assessor voice feedback on failed assessments.
-- Grants are applied for both app roles per repo convention.

CREATE TABLE IF NOT EXISTS assessment_voice_messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     UUID        NOT NULL
                                  REFERENCES package_assessments(id) ON DELETE CASCADE,
  assessor_id       UUID        NOT NULL
                                  REFERENCES profiles(id),
  file_path         TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL,
  size_bytes        BIGINT      NOT NULL,
  duration_seconds  INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: fast look-up by assessment (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_avm_assessment_id
  ON assessment_voice_messages(assessment_id);

-- Grants for app roles
GRANT SELECT, INSERT, UPDATE, DELETE
  ON assessment_voice_messages TO kunacademy;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON assessment_voice_messages TO kunacademy_admin;

-- RLS: disable (table is accessed exclusively through withAdminContext /
-- withUserContext which set the role explicitly and bypass RLS via
-- kunacademy_admin). Keeping this explicit to match the pattern on other
-- Phase-2.x tables (package_assessments has RLS disabled too).
ALTER TABLE assessment_voice_messages DISABLE ROW LEVEL SECURITY;
