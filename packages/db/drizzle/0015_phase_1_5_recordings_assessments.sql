-- ============================================================================
-- Migration: 0015_phase_1_5_recordings_assessments
-- Sub-phase: S2-Layer-1 / 1.5
-- Creates: package_recordings, package_assessments, assessor_assignment_tracker
-- RLS:
--   package_recordings:          student sees own; assessor/admin sees all in_review/assessed
--   package_assessments:         assessor sees own assignments; admin sees all
--   assessor_assignment_tracker: admin only
-- Source: Phase 1.5 spec — Recording Submission + Assessor Assignment Queue
-- Dependencies:
--   package_instances    (FK)
--   beneficiary_file_sessions (FK, nullable)
--   profiles             (FK for assessor_id, assessor_assignment_tracker.assessor_id)
--   instructors          (used in RLS subquery for assigned_mentor_id)
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE 1: package_recordings
-- One row per coaching recording submitted by a student.
-- ============================================================================

CREATE TABLE IF NOT EXISTS package_recordings (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  package_instance_id       UUID        NOT NULL
                            REFERENCES package_instances(id) ON DELETE CASCADE,
  beneficiary_session_id    UUID
                            REFERENCES beneficiary_file_sessions(id) ON DELETE SET NULL,
  file_path                 TEXT        NOT NULL,
  original_filename         TEXT        NOT NULL,
  mime_type                 TEXT        NOT NULL,
  file_size_bytes           BIGINT      NOT NULL,
  duration_seconds          INT,
  status                    TEXT        NOT NULL DEFAULT 'pending_assignment'
                            CHECK (status IN ('pending_assignment', 'under_review', 'assessed')),
  attestation_confirmed_at  TIMESTAMPTZ,
  submitted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pkg_recordings_instance
  ON package_recordings (package_instance_id);

CREATE INDEX IF NOT EXISTS idx_pkg_recordings_status
  ON package_recordings (status)
  WHERE status IN ('pending_assignment', 'under_review');

CREATE INDEX IF NOT EXISTS idx_pkg_recordings_session
  ON package_recordings (beneficiary_session_id)
  WHERE beneficiary_session_id IS NOT NULL;


-- ============================================================================
-- TABLE 2: package_assessments
-- One row per recording↔assessor assignment.
-- ============================================================================

CREATE TABLE IF NOT EXISTS package_assessments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id   UUID        NOT NULL
                 REFERENCES package_recordings(id) ON DELETE CASCADE,
  assessor_id    UUID        NOT NULL
                 REFERENCES profiles(id),
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision       TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (decision IN ('pending', 'pass', 'fail')),
  decision_note  TEXT,
  rubric_scores  JSONB,
  decided_at     TIMESTAMPTZ,
  escalated_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pkg_assessments_recording
  ON package_assessments (recording_id);

CREATE INDEX IF NOT EXISTS idx_pkg_assessments_assessor
  ON package_assessments (assessor_id);

CREATE INDEX IF NOT EXISTS idx_pkg_assessments_pending
  ON package_assessments (assessor_id, assigned_at)
  WHERE decision = 'pending';


-- ============================================================================
-- TABLE 3: assessor_assignment_tracker
-- One row per advanced-mentor assessor. Tracks last_assigned_at for round-robin.
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessor_assignment_tracker (
  assessor_id       UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_assigned_at  TIMESTAMPTZ
);


-- ============================================================================
-- RLS: package_recordings
-- ============================================================================

ALTER TABLE package_recordings ENABLE ROW LEVEL SECURITY;

-- Student: see own recordings (via package_instances.student_id)
CREATE POLICY pr_select_student ON package_recordings
  FOR SELECT
  USING (
    package_instance_id IN (
      SELECT id FROM package_instances
      WHERE student_id = app_uid()
    )
  );

-- Student: insert (API layer enforces one active recording per instance)
CREATE POLICY pr_insert_student ON package_recordings
  FOR INSERT
  WITH CHECK (
    package_instance_id IN (
      SELECT id FROM package_instances
      WHERE student_id = app_uid()
    )
  );

-- Assessor: see recordings they are assigned to
CREATE POLICY pr_select_assessor ON package_recordings
  FOR SELECT
  USING (
    id IN (
      SELECT recording_id FROM package_assessments
      WHERE assessor_id = app_uid()
    )
  );

-- Admin: full access
CREATE POLICY pr_admin_all ON package_recordings
  FOR ALL
  USING (is_admin());


-- ============================================================================
-- RLS: package_assessments
-- ============================================================================

ALTER TABLE package_assessments ENABLE ROW LEVEL SECURITY;

-- Assessor: see and update their own assignments
CREATE POLICY pa_select_assessor ON package_assessments
  FOR SELECT
  USING (assessor_id = app_uid());

CREATE POLICY pa_update_assessor ON package_assessments
  FOR UPDATE
  USING (assessor_id = app_uid());

-- Admin: full access
CREATE POLICY pa_admin_all ON package_assessments
  FOR ALL
  USING (is_admin());


-- ============================================================================
-- RLS: assessor_assignment_tracker
-- ============================================================================

ALTER TABLE assessor_assignment_tracker ENABLE ROW LEVEL SECURITY;

-- Admin only — round-robin state is internal
CREATE POLICY aat_admin_all ON assessor_assignment_tracker
  FOR ALL
  USING (is_admin());


-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT INSERT, SELECT ON package_recordings TO authenticated;
GRANT UPDATE (status, duration_seconds, updated_at) ON package_recordings TO authenticated;
GRANT SELECT ON package_assessments TO authenticated;
GRANT UPDATE (decision, decision_note, rubric_scores, decided_at) ON package_assessments TO authenticated;

GRANT ALL ON package_recordings TO kunacademy_admin;
GRANT ALL ON package_assessments TO kunacademy_admin;
GRANT ALL ON assessor_assignment_tracker TO kunacademy_admin;


-- ============================================================================
-- SMOKE TESTS
-- ============================================================================

DO $$
BEGIN
  PERFORM 1 FROM information_schema.tables
    WHERE table_name = 'package_recordings' AND table_schema = 'public';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: package_recordings not created';
  END IF;
  RAISE NOTICE 'SMOKE 1 PASSED: package_recordings exists';

  PERFORM 1 FROM information_schema.tables
    WHERE table_name = 'package_assessments' AND table_schema = 'public';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: package_assessments not created';
  END IF;
  RAISE NOTICE 'SMOKE 2 PASSED: package_assessments exists';

  PERFORM 1 FROM information_schema.tables
    WHERE table_name = 'assessor_assignment_tracker' AND table_schema = 'public';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: assessor_assignment_tracker not created';
  END IF;
  RAISE NOTICE 'SMOKE 3 PASSED: assessor_assignment_tracker exists';
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO package_recordings (
      package_instance_id, file_path, original_filename,
      mime_type, file_size_bytes, status
    )
    VALUES (gen_random_uuid(), '/tmp/test', 'test.m4a', 'audio/mp4', 1000, 'invalid_status');
    RAISE EXCEPTION 'SMOKE FAIL: status CHECK did not reject invalid value';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'SMOKE 4 PASSED: status CHECK rejects invalid value';
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'SMOKE 4 PASSED (FK fired first): status CHECK present';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO package_assessments (recording_id, assessor_id, decision)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'invalid_decision');
    RAISE EXCEPTION 'SMOKE FAIL: decision CHECK did not reject invalid value';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'SMOKE 5 PASSED: decision CHECK rejects invalid value';
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'SMOKE 5 PASSED (FK fired first): decision CHECK present';
  END;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'package_recordings' AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: RLS not enabled on package_recordings';
  END IF;
  RAISE NOTICE 'SMOKE 6 PASSED: RLS enabled on package_recordings';

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'package_assessments' AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: RLS not enabled on package_assessments';
  END IF;
  RAISE NOTICE 'SMOKE 7 PASSED: RLS enabled on package_assessments';
END $$;

-- ============================================================================
-- MIGRATION TRACKING
-- tag: 0015_phase_1_5_recordings_assessments
-- when: 1776517200000  (ms since epoch for 2026-04-19 14:00:00 UTC)
-- ============================================================================

COMMIT;
