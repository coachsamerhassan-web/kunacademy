-- Migration 0046: Polymorphic lesson blocks + reusable lesson placements + audio exchange infra
--
-- Session A of the LESSON-BLOCKS wave. Refactors the monolithic `lessons` table
-- (one video_url column) into a reusable content object composed of ordered
-- polymorphic blocks, placeable in multiple courses via `lesson_placements`.
-- Student audio responses are course-placement-scoped so a response in Course A
-- does not aggregate with Course B.
--
-- Decisions (Samer, 2026-04-22):
--   D4a=iii — audio_exchange is "reflection by default, flag-to-quiz-like"
--             via requires_review boolean.
--   D4b=ii  — coach text-comments on responses (default; structured rubric deferred).
--   D4c=iii — big-bang drop of `video_url` (confirmed 0 data rows).
--   D4d=iii — hybrid library: private by default; creator can promote to
--             team_library via scope flag.
--   D4e=i   — creator is sole editor of team_library lessons; other coaches
--             (=iii) may clone-to-fork via INSERT-as-self.
--   D4f=i   — cannot delete a lesson placed in any course (ON DELETE RESTRICT
--             on lesson_placements.lesson_id).
--   D5      — direct-to-main, no feature branch.
--
-- OUT OF SCOPE (Session B/C):
--   - lesson_progress and quiz_attempts keep referencing lessons.id (zero rows
--     today, safe). Full placement-scoping migrates later.
--   - Admin write APIs, admin UI, student lesson player.
--
-- Ground truth pre-migration:
--   SELECT count(*), count(video_url) FROM lessons;  -- 12 rows, 0 with video_url
--   SELECT count(*) FROM lesson_progress;             -- 0
--   SELECT count(*) FROM quiz_attempts;               -- 0
--
-- Applied live via: sudo -u postgres psql -d kunacademy -f 0046_lesson_blocks_polymorphic.sql

BEGIN;

-- ── 1. lessons table restructure ─────────────────────────────────────────────
-- Drop unused video columns (big-bang per D4c=iii; 0 populated rows).
ALTER TABLE lessons DROP COLUMN IF EXISTS video_url;
ALTER TABLE lessons DROP COLUMN IF EXISTS video_provider;
ALTER TABLE lessons DROP COLUMN IF EXISTS video_id;
-- Note: duration_minutes retained (not in spec's drop list). If video_duration_sec
-- ever existed, drop here too; safe no-op otherwise.
ALTER TABLE lessons DROP COLUMN IF EXISTS video_duration_sec;

-- Make legacy course/section FKs nullable — new linkage lives in lesson_placements.
ALTER TABLE lessons ALTER COLUMN course_id DROP NOT NULL;
-- section_id is already nullable on live DB; no-op if already so.
ALTER TABLE lessons ALTER COLUMN section_id DROP NOT NULL;

-- Add library flags and creator pointer.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'private';
DO $$ BEGIN
  ALTER TABLE lessons
    ADD CONSTRAINT lessons_scope_check
    CHECK (scope IN ('private', 'team_library'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Timestamps for auditability (many sibling tables have them; lessons did not).
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── 2. lesson_placements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_placements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id      UUID REFERENCES course_sections(id) ON DELETE SET NULL,
  lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,  -- D4f=i: block deletion if placed
  sort_order      INTEGER NOT NULL,
  override_title_ar TEXT,
  override_title_en TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_placements_section_sort_unique UNIQUE (section_id, sort_order),
  CONSTRAINT lesson_placements_course_lesson_section_unique UNIQUE (course_id, lesson_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_placements_course
  ON lesson_placements(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_placements_lesson
  ON lesson_placements(lesson_id);

ALTER TABLE lesson_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_placements_admin ON lesson_placements;
CREATE POLICY lesson_placements_admin ON lesson_placements
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS lesson_placements_coach ON lesson_placements;
-- Coach role sees placements for courses they can administer. For now we
-- grant coaches + admins via is_admin() + role check; tighten in Session B
-- when admin UI specifies per-course coach ownership.
CREATE POLICY lesson_placements_coach ON lesson_placements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = app_uid()
         AND p.role IN ('admin', 'super_admin', 'coach', 'instructor')
    )
  );

DROP POLICY IF EXISTS lesson_placements_student_enrolled ON lesson_placements;
CREATE POLICY lesson_placements_student_enrolled ON lesson_placements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enrollments e
       WHERE e.user_id = app_uid()
         AND e.course_id = lesson_placements.course_id
         AND e.status IN ('enrolled', 'in_progress', 'completed')
    )
  );

GRANT SELECT                         ON lesson_placements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_placements TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_placements TO kunacademy_admin;
-- No anon grant — no published surface for placements yet.

-- ── 3. lesson_audio_exchanges ────────────────────────────────────────────────
-- Defined before lesson_blocks because lesson_blocks.audio_exchange_id FKs it.
CREATE TABLE IF NOT EXISTS lesson_audio_exchanges (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_audio_url        TEXT NOT NULL,
  prompt_duration_sec     INTEGER,
  prompt_transcript_ar    TEXT,
  prompt_transcript_en    TEXT,
  instructions_ar         TEXT,
  instructions_en         TEXT,
  response_mode           TEXT NOT NULL DEFAULT 'either',
  response_time_limit_sec INTEGER,
  requires_review         BOOLEAN NOT NULL DEFAULT false,  -- D4a=iii: flag-to-quiz-like
  created_by              UUID REFERENCES profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_audio_exchanges_response_mode_check
    CHECK (response_mode IN ('audio_only', 'text_only', 'either'))
);

ALTER TABLE lesson_audio_exchanges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_audio_exchanges_admin ON lesson_audio_exchanges;
CREATE POLICY lesson_audio_exchanges_admin ON lesson_audio_exchanges
  FOR ALL USING (is_admin());

-- D4e=i + =iii: only creator can UPDATE; other coaches can SELECT (for picker) and INSERT their own.
DROP POLICY IF EXISTS lesson_audio_exchanges_creator_update ON lesson_audio_exchanges;
CREATE POLICY lesson_audio_exchanges_creator_update ON lesson_audio_exchanges
  FOR UPDATE USING (created_by = app_uid());

DROP POLICY IF EXISTS lesson_audio_exchanges_creator_delete ON lesson_audio_exchanges;
CREATE POLICY lesson_audio_exchanges_creator_delete ON lesson_audio_exchanges
  FOR DELETE USING (created_by = app_uid());

DROP POLICY IF EXISTS lesson_audio_exchanges_coach_insert ON lesson_audio_exchanges;
CREATE POLICY lesson_audio_exchanges_coach_insert ON lesson_audio_exchanges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = app_uid()
         AND p.role IN ('admin', 'super_admin', 'coach', 'instructor')
    )
    AND created_by = app_uid()
  );

DROP POLICY IF EXISTS lesson_audio_exchanges_coach_select ON lesson_audio_exchanges;
CREATE POLICY lesson_audio_exchanges_coach_select ON lesson_audio_exchanges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = app_uid()
         AND p.role IN ('admin', 'super_admin', 'coach', 'instructor')
    )
  );

-- The student-enrolled SELECT policy on lesson_audio_exchanges requires
-- lesson_blocks to exist (joins through it). Policy is added AFTER
-- lesson_blocks CREATE TABLE, below.

GRANT SELECT                         ON lesson_audio_exchanges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_audio_exchanges TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_audio_exchanges TO kunacademy_admin;

-- ── 4. lesson_blocks ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id         UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL,
  block_type        TEXT NOT NULL,
  block_data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz_id           UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  audio_exchange_id UUID REFERENCES lesson_audio_exchanges(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_blocks_lesson_sort_unique UNIQUE (lesson_id, sort_order),
  CONSTRAINT lesson_blocks_block_type_check
    CHECK (block_type IN (
      'video', 'text', 'pdf', 'image', 'audio',
      'callout', 'quiz_ref', 'audio_exchange'
    )),
  -- Ref-integrity check — two-way: the FK is required iff the matching
  -- block_type is set; AND the off-type FK must be null. Prevents e.g. a
  -- block_type='video' row from carrying a stray quiz_id.
  CONSTRAINT lesson_blocks_ref_integrity_check CHECK (
    (block_type = 'quiz_ref'       AND quiz_id           IS NOT NULL AND audio_exchange_id IS NULL) OR
    (block_type = 'audio_exchange' AND audio_exchange_id IS NOT NULL AND quiz_id           IS NULL) OR
    (block_type NOT IN ('quiz_ref', 'audio_exchange')  AND quiz_id IS NULL AND audio_exchange_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_lesson_blocks_lesson
  ON lesson_blocks(lesson_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_blocks_quiz
  ON lesson_blocks(quiz_id) WHERE quiz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_blocks_audio_exchange
  ON lesson_blocks(audio_exchange_id) WHERE audio_exchange_id IS NOT NULL;

ALTER TABLE lesson_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_blocks_admin ON lesson_blocks;
CREATE POLICY lesson_blocks_admin ON lesson_blocks
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS lesson_blocks_coach ON lesson_blocks;
CREATE POLICY lesson_blocks_coach ON lesson_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = app_uid()
         AND p.role IN ('admin', 'super_admin', 'coach', 'instructor')
    )
  );

DROP POLICY IF EXISTS lesson_blocks_student_enrolled ON lesson_blocks;
CREATE POLICY lesson_blocks_student_enrolled ON lesson_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM lesson_placements p
        JOIN enrollments e ON e.course_id = p.course_id
       WHERE p.lesson_id = lesson_blocks.lesson_id
         AND e.user_id = app_uid()
         AND e.status IN ('enrolled', 'in_progress', 'completed')
    )
  );

GRANT SELECT                         ON lesson_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_blocks TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_blocks TO kunacademy_admin;

-- Deferred policy: student-enrolled SELECT on lesson_audio_exchanges
-- (placed here because it joins through lesson_blocks).
DROP POLICY IF EXISTS lesson_audio_exchanges_student_enrolled ON lesson_audio_exchanges;
CREATE POLICY lesson_audio_exchanges_student_enrolled ON lesson_audio_exchanges
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM lesson_blocks b
        JOIN lesson_placements p ON p.lesson_id = b.lesson_id
        JOIN enrollments e       ON e.course_id = p.course_id
       WHERE b.audio_exchange_id = lesson_audio_exchanges.id
         AND e.user_id = app_uid()
         AND e.status IN ('enrolled', 'in_progress', 'completed')
    )
  );

-- ── 5. lesson_audio_responses ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_audio_responses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id         UUID NOT NULL REFERENCES lesson_audio_exchanges(id) ON DELETE CASCADE,
  placement_id        UUID NOT NULL REFERENCES lesson_placements(id) ON DELETE CASCADE,  -- course-scoped
  student_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  audio_url           TEXT,
  audio_duration_sec  INTEGER,
  text_response       TEXT,
  coach_comment       TEXT,                                               -- D4b=ii
  coach_commented_at  TIMESTAMPTZ,
  coach_commented_by  UUID REFERENCES profiles(id),
  review_status       TEXT,                                               -- NULL unless exchange.requires_review
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_audio_responses_review_status_check
    CHECK (review_status IS NULL OR review_status IN ('pending', 'reviewed', 'approved', 'needs_rework')),
  CONSTRAINT lesson_audio_responses_payload_check
    CHECK (audio_url IS NOT NULL OR text_response IS NOT NULL),
  CONSTRAINT lesson_audio_responses_unique UNIQUE (exchange_id, placement_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_audio_responses_exchange
  ON lesson_audio_responses(exchange_id, placement_id);
CREATE INDEX IF NOT EXISTS idx_lesson_audio_responses_student
  ON lesson_audio_responses(student_id, submitted_at DESC);
-- Coach-policy join optimization: placement_id is the join key.
CREATE INDEX IF NOT EXISTS idx_lesson_audio_responses_placement
  ON lesson_audio_responses(placement_id, submitted_at DESC);

ALTER TABLE lesson_audio_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_audio_responses_admin ON lesson_audio_responses;
CREATE POLICY lesson_audio_responses_admin ON lesson_audio_responses
  FOR ALL USING (is_admin());

-- Student can SELECT, INSERT, UPDATE their own responses.
DROP POLICY IF EXISTS lesson_audio_responses_student_own ON lesson_audio_responses;
CREATE POLICY lesson_audio_responses_student_own ON lesson_audio_responses
  FOR SELECT USING (student_id = app_uid());

DROP POLICY IF EXISTS lesson_audio_responses_student_insert ON lesson_audio_responses;
CREATE POLICY lesson_audio_responses_student_insert ON lesson_audio_responses
  FOR INSERT WITH CHECK (student_id = app_uid());

DROP POLICY IF EXISTS lesson_audio_responses_student_update ON lesson_audio_responses;
CREATE POLICY lesson_audio_responses_student_update ON lesson_audio_responses
  FOR UPDATE USING (student_id = app_uid());

-- Assigned coach (course instructor) can SELECT. Tightened per-course ownership
-- comes in Session B with placement ownership metadata.
DROP POLICY IF EXISTS lesson_audio_responses_coach_select ON lesson_audio_responses;
CREATE POLICY lesson_audio_responses_coach_select ON lesson_audio_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM lesson_placements lp
        JOIN courses c      ON c.id = lp.course_id
        JOIN instructors i  ON i.id = c.instructor_id
        JOIN profiles p_in  ON p_in.id = i.profile_id
       WHERE lp.id = lesson_audio_responses.placement_id
         AND p_in.id = app_uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = app_uid()
         AND p.role IN ('admin', 'super_admin')
    )
  );

-- Coach comment updates: same scope as SELECT — assigned instructor or admin.
DROP POLICY IF EXISTS lesson_audio_responses_coach_update ON lesson_audio_responses;
CREATE POLICY lesson_audio_responses_coach_update ON lesson_audio_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
        FROM lesson_placements lp
        JOIN courses c      ON c.id = lp.course_id
        JOIN instructors i  ON i.id = c.instructor_id
        JOIN profiles p_in  ON p_in.id = i.profile_id
       WHERE lp.id = lesson_audio_responses.placement_id
         AND p_in.id = app_uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = app_uid()
         AND p.role IN ('admin', 'super_admin')
    )
  );

GRANT SELECT, INSERT, UPDATE         ON lesson_audio_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_audio_responses TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_audio_responses TO kunacademy_admin;

-- ── 6. Verification ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_table_count int;
  v_dropped_col int;
BEGIN
  -- Confirm new tables exist.
  SELECT count(*) INTO v_table_count
    FROM information_schema.tables
   WHERE table_name IN (
     'lesson_placements',
     'lesson_blocks',
     'lesson_audio_exchanges',
     'lesson_audio_responses'
   );
  IF v_table_count < 4 THEN
    RAISE EXCEPTION 'lesson_blocks schema incomplete: expected 4 tables, got %', v_table_count;
  END IF;

  -- Confirm video_url column was dropped.
  SELECT count(*) INTO v_dropped_col
    FROM information_schema.columns
   WHERE table_name = 'lessons' AND column_name = 'video_url';
  IF v_dropped_col > 0 THEN
    RAISE EXCEPTION 'lessons.video_url should have been dropped';
  END IF;

  -- Confirm lessons.scope + is_global + created_by exist.
  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'lessons' AND column_name = 'scope';
  IF NOT FOUND THEN RAISE EXCEPTION 'lessons.scope column missing'; END IF;

  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'lessons' AND column_name = 'is_global';
  IF NOT FOUND THEN RAISE EXCEPTION 'lessons.is_global column missing'; END IF;

  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'lessons' AND column_name = 'created_by';
  IF NOT FOUND THEN RAISE EXCEPTION 'lessons.created_by column missing'; END IF;

  RAISE NOTICE 'Migration 0046 OK: 4 new tables + lessons restructured (video_url dropped, scope/is_global/created_by added)';
END $$;

COMMIT;
