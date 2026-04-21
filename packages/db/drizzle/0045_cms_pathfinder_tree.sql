-- Migration 0045: CMS→DB final — pathfinder tree (questions + answers + outcomes + versioning)
--
-- Closes the CMS→DB drop. Replaces apps/web/data/cms/pathfinder.json (15 questions +
-- 41 answers) with a versioned, editable, RLS-protected relational tree per Hakima's
-- proposal (HAKIMA-PATHFINDER-SCHEMA-PROPOSAL.md Section 4).
--
-- Design (locked decisions per Samer 2026-04-21):
--   1. Tree versioned via pathfinder_tree_versions — exactly one row has
--      is_active=true (enforced by partial unique index).
--   2. Full tree cloning for new versions — clone active → edit → publish.
--   3. pathfinder_questions self-references pathfinder_answers(id) for branching
--      (parent_answer_id NULL = root).
--   4. pathfinder_answers.category_weights JSONB (7 categories: certification, course,
--      free, coaching, retreat, family, corporate).
--   5. pathfinder_outcomes — per-version program affinity map (one row per
--      (version_id, program_slug)).
--   6. pathfinder_responses gets tree_version_id FK (nullable for legacy rows).
--
-- RLS: anon SELECT where published=true AND version is_active=true; admin ALL.
--
-- Grants: anon SELECT; authenticated SELECT; kunacademy (app) SELECT/INSERT/UPDATE/DELETE;
--         kunacademy_admin SELECT/INSERT/UPDATE/DELETE.

BEGIN;

-- ── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE pathfinder_question_type AS ENUM ('individual', 'corporate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pathfinder_outcome_cta_type AS ENUM ('book_call', 'enroll', 'explore', 'free_signup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── pathfinder_tree_versions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pathfinder_tree_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number  INTEGER NOT NULL,
  label           TEXT NOT NULL,
  published_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pathfinder_tree_versions_version_number_unique UNIQUE (version_number)
);

-- Enforce exactly-one-active constraint via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS pathfinder_tree_versions_one_active_idx
  ON pathfinder_tree_versions (is_active) WHERE is_active = true;

ALTER TABLE pathfinder_tree_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pathfinder_tree_versions_public_select ON pathfinder_tree_versions;
CREATE POLICY pathfinder_tree_versions_public_select ON pathfinder_tree_versions
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS pathfinder_tree_versions_admin ON pathfinder_tree_versions;
CREATE POLICY pathfinder_tree_versions_admin ON pathfinder_tree_versions
  FOR ALL USING (is_admin());

GRANT SELECT                         ON pathfinder_tree_versions TO anon;
GRANT SELECT                         ON pathfinder_tree_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pathfinder_tree_versions TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON pathfinder_tree_versions TO kunacademy_admin;

-- ── pathfinder_questions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pathfinder_questions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id         UUID NOT NULL REFERENCES pathfinder_tree_versions(id) ON DELETE CASCADE,
  code               TEXT NOT NULL,
  question_ar        TEXT NOT NULL,
  question_en        TEXT,
  type               pathfinder_question_type NOT NULL DEFAULT 'individual',
  parent_answer_id   UUID,  -- FK added below (self-referential via pathfinder_answers)
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_terminal_gate   BOOLEAN NOT NULL DEFAULT false,
  published          BOOLEAN NOT NULL DEFAULT true,
  last_edited_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_edited_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pathfinder_questions_version_code_unique UNIQUE (version_id, code)
);

CREATE INDEX IF NOT EXISTS pathfinder_questions_version_parent_idx
  ON pathfinder_questions (version_id, parent_answer_id);
CREATE INDEX IF NOT EXISTS pathfinder_questions_version_sort_idx
  ON pathfinder_questions (version_id, sort_order);

ALTER TABLE pathfinder_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pathfinder_questions_public_select ON pathfinder_questions;
CREATE POLICY pathfinder_questions_public_select ON pathfinder_questions
  FOR SELECT USING (
    published = true
    AND EXISTS (
      SELECT 1 FROM pathfinder_tree_versions v
       WHERE v.id = pathfinder_questions.version_id
         AND v.is_active = true
    )
  );

DROP POLICY IF EXISTS pathfinder_questions_admin ON pathfinder_questions;
CREATE POLICY pathfinder_questions_admin ON pathfinder_questions
  FOR ALL USING (is_admin());

GRANT SELECT                         ON pathfinder_questions TO anon;
GRANT SELECT                         ON pathfinder_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pathfinder_questions TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON pathfinder_questions TO kunacademy_admin;

-- ── pathfinder_answers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pathfinder_answers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id         UUID NOT NULL REFERENCES pathfinder_questions(id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  text_ar             TEXT NOT NULL,
  text_en             TEXT,
  category_weights    JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_slugs   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pathfinder_answers_question_code_unique UNIQUE (question_id, code)
);

CREATE INDEX IF NOT EXISTS pathfinder_answers_question_sort_idx
  ON pathfinder_answers (question_id, sort_order);

-- Now wire the self-referential FK: questions.parent_answer_id → answers.id
DO $$ BEGIN
  ALTER TABLE pathfinder_questions
    ADD CONSTRAINT pathfinder_questions_parent_answer_fk
    FOREIGN KEY (parent_answer_id) REFERENCES pathfinder_answers(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE pathfinder_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pathfinder_answers_public_select ON pathfinder_answers;
CREATE POLICY pathfinder_answers_public_select ON pathfinder_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pathfinder_questions q
       JOIN pathfinder_tree_versions v ON v.id = q.version_id
      WHERE q.id = pathfinder_answers.question_id
        AND q.published = true
        AND v.is_active = true
    )
  );

DROP POLICY IF EXISTS pathfinder_answers_admin ON pathfinder_answers;
CREATE POLICY pathfinder_answers_admin ON pathfinder_answers
  FOR ALL USING (is_admin());

GRANT SELECT                         ON pathfinder_answers TO anon;
GRANT SELECT                         ON pathfinder_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pathfinder_answers TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON pathfinder_answers TO kunacademy_admin;

-- ── pathfinder_outcomes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pathfinder_outcomes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id           UUID NOT NULL REFERENCES pathfinder_tree_versions(id) ON DELETE CASCADE,
  program_slug         TEXT NOT NULL,
  category_affinity    JSONB NOT NULL DEFAULT '{}'::jsonb,
  min_score            INTEGER NOT NULL DEFAULT 0,
  cta_label_ar         TEXT,
  cta_label_en         TEXT,
  cta_type             pathfinder_outcome_cta_type NOT NULL DEFAULT 'explore',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pathfinder_outcomes_version_slug_unique UNIQUE (version_id, program_slug)
);

CREATE INDEX IF NOT EXISTS pathfinder_outcomes_version_slug_idx
  ON pathfinder_outcomes (version_id, program_slug);

ALTER TABLE pathfinder_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pathfinder_outcomes_public_select ON pathfinder_outcomes;
CREATE POLICY pathfinder_outcomes_public_select ON pathfinder_outcomes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pathfinder_tree_versions v
       WHERE v.id = pathfinder_outcomes.version_id
         AND v.is_active = true
    )
  );

DROP POLICY IF EXISTS pathfinder_outcomes_admin ON pathfinder_outcomes;
CREATE POLICY pathfinder_outcomes_admin ON pathfinder_outcomes
  FOR ALL USING (is_admin());

GRANT SELECT                         ON pathfinder_outcomes TO anon;
GRANT SELECT                         ON pathfinder_outcomes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pathfinder_outcomes TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON pathfinder_outcomes TO kunacademy_admin;

-- ── pathfinder_responses: extend with tree_version_id ─────────────────────
ALTER TABLE pathfinder_responses
  ADD COLUMN IF NOT EXISTS tree_version_id UUID
    REFERENCES pathfinder_tree_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pathfinder_responses_tree_version_idx
  ON pathfinder_responses (tree_version_id);

-- ── Verification ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_table_count int;
BEGIN
  SELECT count(*) INTO v_table_count
    FROM information_schema.tables
   WHERE table_name IN (
     'pathfinder_tree_versions',
     'pathfinder_questions',
     'pathfinder_answers',
     'pathfinder_outcomes'
   );
  IF v_table_count < 4 THEN
    RAISE EXCEPTION 'Pathfinder schema incomplete: expected 4 tables, got %', v_table_count;
  END IF;

  -- Verify tree_version_id column was added to pathfinder_responses
  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'pathfinder_responses' AND column_name = 'tree_version_id';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pathfinder_responses.tree_version_id column missing';
  END IF;

  RAISE NOTICE 'Pathfinder tree schema (0045) created: 4 tables + version column';
END $$;

COMMIT;
