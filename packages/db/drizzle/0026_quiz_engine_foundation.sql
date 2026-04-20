-- =============================================================================
-- 0026: Quiz Engine Foundation
-- Four new tables: quizzes, quiz_questions, quiz_options, quiz_attempts
-- Idempotent — all CREATE statements use IF NOT EXISTS.
-- Do NOT apply via drizzle-kit on VPS (OOM risk). Use psql fallback:
--   sudo -u postgres psql -d kunacademy -f 0026_quiz_engine_foundation.sql
-- =============================================================================


-- ============================================================================
-- TABLE: quizzes
-- ============================================================================

CREATE TABLE IF NOT EXISTS quizzes (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id          uuid        UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  title_ar           text        NOT NULL,
  title_en           text        NOT NULL,
  description_ar     text,
  description_en     text,
  pass_threshold     integer     NOT NULL DEFAULT 70,
  attempts_allowed   integer,                    -- NULL = unlimited
  time_limit_seconds integer,                    -- NULL = no limit
  shuffle_questions  boolean     NOT NULL DEFAULT false,
  is_published       boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- TABLE: quiz_questions
-- ============================================================================

CREATE TABLE IF NOT EXISTS quiz_questions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        uuid        NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  type           text        NOT NULL,
  prompt_ar      text        NOT NULL,
  prompt_en      text        NOT NULL,
  explanation_ar text,
  explanation_en text,
  points         integer     NOT NULL DEFAULT 1,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_questions_type_check
    CHECK (type IN ('single', 'multi', 'true_false', 'short_answer'))
);


-- ============================================================================
-- TABLE: quiz_options
-- ============================================================================
-- Used for single / multi / true_false questions only.
-- short_answer questions have no options (enforced at API layer).
-- SECURITY: is_correct MUST be stripped from API responses to students.
-- Expose is_correct only in admin/instructor endpoints and post-submission results.

CREATE TABLE IF NOT EXISTS quiz_options (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid        NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_ar   text        NOT NULL,
  option_en   text        NOT NULL,
  is_correct  boolean     NOT NULL DEFAULT false,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- TABLE: quiz_attempts
-- ============================================================================
-- One row per student attempt. Answers stored inline as JSONB array:
--   [{ question_id, selected_option_ids?, answer_text?, points_awarded? }, ...]
-- No separate quiz_answers table in this phase — keep scope tight.

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES profiles(id),
  quiz_id       uuid        NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  enrollment_id uuid        REFERENCES enrollments(id) ON DELETE SET NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  submitted_at  timestamptz,          -- NULL = attempt still in progress
  score_points  integer,              -- NULL until submitted
  max_points    integer,              -- snapshot of total points at submission time
  score_pct     integer,              -- computed percentage, NULL until submitted
  passed        boolean,              -- NULL until submitted
  answers_jsonb jsonb,                -- see JSONB shape comment above
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS quiz_questions_quiz_id_sort_order_idx
  ON quiz_questions (quiz_id, sort_order);

CREATE INDEX IF NOT EXISTS quiz_options_question_id_sort_order_idx
  ON quiz_options (question_id, sort_order);

-- "My attempts" query: all attempts by a user for a quiz, newest first
CREATE INDEX IF NOT EXISTS quiz_attempts_user_id_quiz_id_started_at_idx
  ON quiz_attempts (user_id, quiz_id, started_at DESC);


-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON quizzes         TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_questions  TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_options    TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_attempts   TO kunacademy;

GRANT SELECT, INSERT, UPDATE, DELETE ON quizzes         TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_questions  TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_options    TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_attempts   TO kunacademy_admin;


-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE quizzes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_options   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts  ENABLE ROW LEVEL SECURITY;

-- ---- quizzes ----------------------------------------------------------------

-- Any authenticated user can read published quiz metadata
CREATE POLICY quizzes_published_read ON quizzes
  FOR SELECT
  USING (is_published = true);

-- Admin: full access
CREATE POLICY quizzes_admin_all ON quizzes
  FOR ALL
  USING (is_admin());

-- ---- quiz_questions ---------------------------------------------------------

-- Questions are visible when the parent quiz is published
CREATE POLICY quiz_questions_via_published_quiz ON quiz_questions
  FOR SELECT
  USING (
    quiz_id IN (
      SELECT id FROM quizzes WHERE is_published = true
    )
  );

-- Admin: full access
CREATE POLICY quiz_questions_admin_all ON quiz_questions
  FOR ALL
  USING (is_admin());

-- ---- quiz_options -----------------------------------------------------------

-- Options are visible when the parent quiz is published.
-- NOTE: is_correct is included in the row but MUST be stripped in the API
-- layer for student-facing endpoints. RLS controls row visibility only;
-- column-level hiding is handled by the API response serialiser.
CREATE POLICY quiz_options_via_published_quiz ON quiz_options
  FOR SELECT
  USING (
    question_id IN (
      SELECT qq.id
      FROM quiz_questions qq
      JOIN quizzes q ON q.id = qq.quiz_id
      WHERE q.is_published = true
    )
  );

-- Admin: full access
CREATE POLICY quiz_options_admin_all ON quiz_options
  FOR ALL
  USING (is_admin());

-- ---- quiz_attempts ----------------------------------------------------------

-- Student: read own attempts
CREATE POLICY quiz_attempts_own ON quiz_attempts
  FOR SELECT
  USING (user_id = app_uid());

-- Student: insert new attempt (API must verify attempts_allowed before inserting)
CREATE POLICY quiz_attempts_own_insert ON quiz_attempts
  FOR INSERT
  WITH CHECK (user_id = app_uid());

-- Student: update only in-progress attempts (submitted_at IS NULL)
CREATE POLICY quiz_attempts_own_update ON quiz_attempts
  FOR UPDATE
  USING (user_id = app_uid() AND submitted_at IS NULL);

-- Admin: full access
CREATE POLICY quiz_attempts_admin_all ON quiz_attempts
  FOR ALL
  USING (is_admin());
