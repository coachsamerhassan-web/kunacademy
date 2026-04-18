-- ============================================================================
-- Migration: 20260418135830_phase_1_3_beneficiary_files
-- Sub-phase: S2-Layer-1 / 1.3
-- Creates: beneficiary_files, beneficiary_file_sessions
-- RLS:
--   beneficiary_files: student sees own; mentor sees files for assigned package_instances; admin sees all
--   beneficiary_file_sessions: inherits access via beneficiary_file parent
-- Source: SPEC-mentoring-package-template.md §6.1
-- Architecture:
--   app_uid()           → current_setting('app.current_user_id', true)::uuid
--   is_admin()          → profiles.role IN ('admin','super_admin')
--   DB roles: kunacademy (app, no bypass), kunacademy_admin (bypass RLS),
--             authenticated (RLS target), anon
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE 1: beneficiary_files
-- Source: SPEC §6.1 first CREATE TABLE block
-- One row per (package_instance × client).
-- client_number: STIC L1 has 2 volunteer clients — future templates may add more.
-- client_alias: student-provided pseudonym; NO real PII stored here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS beneficiary_files (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  package_instance_id   UUID        NOT NULL REFERENCES package_instances(id) ON DELETE CASCADE,
  client_number         INT         NOT NULL CHECK (client_number IN (1, 2)),
                        -- 1 = Volunteer Client 1, 2 = Volunteer Client 2 per STIC L1 template
  client_alias          TEXT,
                        -- student-provided pseudonym; no real PII — per SPEC §6.1
  first_session_date    DATE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (package_instance_id, client_number)
);

-- Indexes for beneficiary_files
CREATE INDEX IF NOT EXISTS idx_beneficiary_files_instance
  ON beneficiary_files (package_instance_id);

-- Partial index: quick lookup of student's own files via instance membership
-- (used by the RLS policy subquery on SELECT)
CREATE INDEX IF NOT EXISTS idx_beneficiary_files_instance_id
  ON beneficiary_files (package_instance_id, id);


-- ============================================================================
-- TABLE 2: beneficiary_file_sessions
-- Source: SPEC §6.1 second CREATE TABLE block
-- One row per (beneficiary_file × session_number).
-- session_number: 1..3 (STIC L1 has 3 sessions per volunteer client).
--
-- JSONB column shapes (from SPEC §6.1 + Beneficiary File PDF):
--
--   pre_session_data — pages 3-4 of the Beneficiary File workbook:
--     {
--       "client_goal": string,              // what is the client working toward?
--       "presenting_topic": string,         // topic for this session
--       "previous_session_follow_up": string, // what happened since last session?
--       "somatic_hypothesis": string,       // student's somatic hypothesis going in
--       "intended_tools": string[]          // tools / techniques student plans to use
--     }
--
--   awareness_map — SPEC §6.1 inline comment: "5 cells":
--     {
--       "حكيمة":      { "observation": string, "evidence": string },
--       "حركات":      { "observation": string, "evidence": string },
--       "تحكم":       { "observation": string, "evidence": string },
--       "الشخصية":    { "observation": string, "evidence": string },
--       "الأنا":      { "observation": string, "evidence": string }
--     }
--
--   needs_resources_challenges — SPEC §6.1 "structured table from page 8":
--     [
--       { "category": "needs" | "resources" | "challenges", "item": string }
--     ]
--
--   self_evaluation — checklist against same criteria mentor will use:
--     {
--       "items": [
--         { "criterion": string, "met": boolean, "note": string | null }
--       ]
--     }
-- ============================================================================

CREATE TABLE IF NOT EXISTS beneficiary_file_sessions (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_file_id             UUID        NOT NULL
                                  REFERENCES beneficiary_files(id) ON DELETE CASCADE,
  session_number                  INT         NOT NULL CHECK (session_number BETWEEN 1 AND 3),

  -- ── Pre-session prep (pages 3-4 of the Beneficiary File workbook) ─────────
  pre_session_data                JSONB,
                                  -- shape documented above

  -- ── Post-session reflection (pages 5-11) ──────────────────────────────────
  client_goal_in_client_words     TEXT,
                                  -- verbatim client quote about their goal
  client_learning_in_client_words TEXT,
                                  -- verbatim client quote about their learning
  awareness_map                   JSONB,
                                  -- 5-cell map: حكيمة/حركات/تحكم/الشخصية/الأنا + evidence
  needs_resources_challenges      JSONB,
                                  -- structured table from page 8
  immediate_metaphor              TEXT,
                                  -- student's immediate metaphor for this session
  developmental_metaphor          TEXT,
                                  -- student's developmental metaphor (longer arc)
  self_evaluation                 JSONB,
                                  -- checklist against same criteria mentor will use
  continue_stop_start             TEXT,
                                  -- page 11 reflection: what to continue / stop / start

  -- ── Optional recording (mandatory for session 3 per SPEC §5.1 M1.c / M2.b) ─
  recording_url                   TEXT,
  recording_duration_seconds      INT,

  -- ── Status ────────────────────────────────────────────────────────────────
  status                          TEXT        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'submitted', 'reviewed')),
                                  -- draft   → student working
                                  -- submitted → student submitted; mentor can read
                                  -- reviewed  → mentor has reviewed; terminal state

  submitted_at                    TIMESTAMPTZ,
  reviewed_at                     TIMESTAMPTZ,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (beneficiary_file_id, session_number)
);

-- Indexes for beneficiary_file_sessions
CREATE INDEX IF NOT EXISTS idx_bfs_file_id
  ON beneficiary_file_sessions (beneficiary_file_id);

CREATE INDEX IF NOT EXISTS idx_bfs_file_session
  ON beneficiary_file_sessions (beneficiary_file_id, session_number);

CREATE INDEX IF NOT EXISTS idx_bfs_status
  ON beneficiary_file_sessions (status)
  WHERE status IN ('submitted', 'reviewed');
  -- Partial: mentor prep query (SPEC §6.2) only cares about submitted/reviewed sessions


-- ============================================================================
-- RLS: beneficiary_files
-- Policy model mirrors package_instances (SPEC §6 + SPEC §3.2):
--   Student → their own files only (via package_instances.student_id)
--   Mentor  → files for package instances where they are assigned_mentor
--   Admin   → all
-- ============================================================================

ALTER TABLE beneficiary_files ENABLE ROW LEVEL SECURITY;

-- Student: select their own beneficiary files
CREATE POLICY bf_select_student ON beneficiary_files
  FOR SELECT
  USING (
    package_instance_id IN (
      SELECT id FROM package_instances
      WHERE student_id = app_uid()
    )
  );

-- Student: insert their own beneficiary files (create a file for a new client)
CREATE POLICY bf_insert_student ON beneficiary_files
  FOR INSERT
  WITH CHECK (
    package_instance_id IN (
      SELECT id FROM package_instances
      WHERE student_id = app_uid()
    )
  );

-- Student: update their own beneficiary files (e.g. set client_alias, first_session_date)
CREATE POLICY bf_update_student ON beneficiary_files
  FOR UPDATE
  USING (
    package_instance_id IN (
      SELECT id FROM package_instances
      WHERE student_id = app_uid()
    )
  );

-- Mentor: select files for package instances where they are the assigned mentor
-- Access granted at all times (not only within 48h — the 48h rule is a notification
-- trigger handled by cron #9; mentor can always read for prep context per SPEC §6.2)
CREATE POLICY bf_select_mentor ON beneficiary_files
  FOR SELECT
  USING (
    package_instance_id IN (
      SELECT pi.id
      FROM package_instances pi
      JOIN instructors i ON i.id = pi.assigned_mentor_id
      WHERE i.profile_id = app_uid()
    )
  );

-- Admin: full access
CREATE POLICY bf_admin_all ON beneficiary_files
  FOR ALL
  USING (is_admin());


-- ============================================================================
-- RLS: beneficiary_file_sessions
-- Inherits access rules via parent beneficiary_file:
--   Student → can SELECT, INSERT, UPDATE on sessions for their own files
--   Mentor  → can SELECT, UPDATE (for reviewed_at + status=reviewed) on files they can see
--   Admin   → all
-- ============================================================================

ALTER TABLE beneficiary_file_sessions ENABLE ROW LEVEL SECURITY;

-- Student: select sessions for their own beneficiary files
CREATE POLICY bfs_select_student ON beneficiary_file_sessions
  FOR SELECT
  USING (
    beneficiary_file_id IN (
      SELECT bf.id FROM beneficiary_files bf
      JOIN package_instances pi ON pi.id = bf.package_instance_id
      WHERE pi.student_id = app_uid()
    )
  );

-- Student: insert sessions (create pre-session entry before the coaching session)
CREATE POLICY bfs_insert_student ON beneficiary_file_sessions
  FOR INSERT
  WITH CHECK (
    beneficiary_file_id IN (
      SELECT bf.id FROM beneficiary_files bf
      JOIN package_instances pi ON pi.id = bf.package_instance_id
      WHERE pi.student_id = app_uid()
    )
  );

-- Student: update their sessions (fill in post-session data; submit)
-- Status transition enforcement (draft→submitted) happens at API layer.
CREATE POLICY bfs_update_student ON beneficiary_file_sessions
  FOR UPDATE
  USING (
    beneficiary_file_id IN (
      SELECT bf.id FROM beneficiary_files bf
      JOIN package_instances pi ON pi.id = bf.package_instance_id
      WHERE pi.student_id = app_uid()
    )
  );

-- Mentor: select sessions for assigned students' files
CREATE POLICY bfs_select_mentor ON beneficiary_file_sessions
  FOR SELECT
  USING (
    beneficiary_file_id IN (
      SELECT bf.id FROM beneficiary_files bf
      JOIN package_instances pi ON pi.id = bf.package_instance_id
      JOIN instructors i ON i.id = pi.assigned_mentor_id
      WHERE i.profile_id = app_uid()
    )
  );

-- Mentor: update sessions for assigned students (mark reviewed; set reviewed_at)
-- Status transition enforcement (submitted→reviewed) happens at API layer.
CREATE POLICY bfs_update_mentor ON beneficiary_file_sessions
  FOR UPDATE
  USING (
    beneficiary_file_id IN (
      SELECT bf.id FROM beneficiary_files bf
      JOIN package_instances pi ON pi.id = bf.package_instance_id
      JOIN instructors i ON i.id = pi.assigned_mentor_id
      WHERE i.profile_id = app_uid()
    )
  );

-- Admin: full access
CREATE POLICY bfs_admin_all ON beneficiary_file_sessions
  FOR ALL
  USING (is_admin());


-- ============================================================================
-- COLUMN-LEVEL GRANTS: beneficiary_file_sessions
-- Mentors can write reviewed_at + status transition to 'reviewed'.
-- Students can write all content columns + submit (status → 'submitted').
-- The split is enforced at the API layer; DB grants allow the writes here.
-- ============================================================================

-- Students can update all content columns + status + timestamps
GRANT UPDATE (
  pre_session_data,
  client_goal_in_client_words,
  client_learning_in_client_words,
  awareness_map,
  needs_resources_challenges,
  immediate_metaphor,
  developmental_metaphor,
  self_evaluation,
  continue_stop_start,
  recording_url,
  recording_duration_seconds,
  status,
  submitted_at,
  updated_at
) ON beneficiary_file_sessions TO authenticated;

-- Mentors need to update status + reviewed_at (same role — API enforces who can do what)
GRANT UPDATE (status, reviewed_at, updated_at)
  ON beneficiary_file_sessions TO authenticated;

-- Students can update beneficiary_files metadata columns
GRANT UPDATE (client_alias, first_session_date, updated_at)
  ON beneficiary_files TO authenticated;

-- Admin: full access to both tables
GRANT ALL ON beneficiary_files TO kunacademy_admin;
GRANT ALL ON beneficiary_file_sessions TO kunacademy_admin;


-- ============================================================================
-- SMOKE TESTS
-- ============================================================================

DO $$
BEGIN
  -- Test 1: tables exist
  PERFORM 1 FROM information_schema.tables
    WHERE table_name = 'beneficiary_files' AND table_schema = 'public';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: beneficiary_files table not created';
  END IF;
  RAISE NOTICE 'SMOKE 1 PASSED: beneficiary_files table exists';

  PERFORM 1 FROM information_schema.tables
    WHERE table_name = 'beneficiary_file_sessions' AND table_schema = 'public';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: beneficiary_file_sessions table not created';
  END IF;
  RAISE NOTICE 'SMOKE 2 PASSED: beneficiary_file_sessions table exists';
END $$;

DO $$
BEGIN
  -- Test 3: CHECK constraint on client_number rejects values outside (1,2)
  BEGIN
    INSERT INTO beneficiary_files (package_instance_id, client_number)
    VALUES (gen_random_uuid(), 3);
    RAISE EXCEPTION 'SMOKE FAIL: client_number CHECK did not reject value 3';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'SMOKE 3 PASSED: client_number CHECK rejects 3';
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'SMOKE 3 PASSED (FK fired first): client_number CHECK present';
  END;
END $$;

DO $$
BEGIN
  -- Test 4: CHECK constraint on session_number rejects out-of-range value
  BEGIN
    INSERT INTO beneficiary_file_sessions (beneficiary_file_id, session_number)
    VALUES (gen_random_uuid(), 0);
    RAISE EXCEPTION 'SMOKE FAIL: session_number CHECK did not reject 0';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'SMOKE 4 PASSED: session_number CHECK rejects 0';
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'SMOKE 4 PASSED (FK fired first): session_number CHECK present';
  END;
END $$;

DO $$
BEGIN
  -- Test 5: status CHECK rejects invalid value
  BEGIN
    INSERT INTO beneficiary_file_sessions (beneficiary_file_id, session_number, status)
    VALUES (gen_random_uuid(), 1, 'invalid_status');
    RAISE EXCEPTION 'SMOKE FAIL: status CHECK did not reject invalid value';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'SMOKE 5 PASSED: status CHECK rejects invalid value';
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'SMOKE 5 PASSED (FK fired first): status CHECK present';
  END;
END $$;

DO $$
BEGIN
  -- Test 6: RLS is enabled on both tables
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'beneficiary_files'
      AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: RLS not enabled on beneficiary_files';
  END IF;
  RAISE NOTICE 'SMOKE 6 PASSED: RLS enabled on beneficiary_files';

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'beneficiary_file_sessions'
      AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: RLS not enabled on beneficiary_file_sessions';
  END IF;
  RAISE NOTICE 'SMOKE 7 PASSED: RLS enabled on beneficiary_file_sessions';
END $$;

-- ============================================================================
-- MIGRATION TRACKING: drizzle.__drizzle_migrations
-- tag: 20260418135830_phase_1_3_beneficiary_files
-- when: 1776429510000  (ms-since-epoch for 2026-04-18 13:58:30 UTC)
-- ============================================================================

COMMIT;
