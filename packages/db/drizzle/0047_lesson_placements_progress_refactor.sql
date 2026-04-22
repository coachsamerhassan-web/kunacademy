-- Migration 0047: Placement-scoping for lesson_progress + quiz_attempts, plus
-- Session B RLS tightening for placement writes + audio-exchange/block creator edits.
--
-- Session B of the LESSON-BLOCKS wave. Additive refactor: both tables get a
-- nullable `placement_id` FK to `lesson_placements`. Legacy `lesson_id` stays
-- (nullable permitted on writes). App layer prefers placement_id when set.
-- Unique constraints swapped from (user_id, lesson_id) to
-- (user_id, placement_id) partial indexes so Course A attempts don't collide
-- with Course B attempts of the SAME underlying lesson.
--
-- Ground truth pre-migration (re-verified 2026-04-22):
--   SELECT count(*) FROM lesson_progress;           -- 0
--   SELECT count(*) FROM quiz_attempts;             -- 0
--   SELECT count(*) FROM enrollments
--     WHERE status IN ('enrolled','in_progress','completed'); -- 0
--
-- Why additive (not destructive) swap:
--   - /api/lms/progress still reads/writes lesson_progress.lesson_id.
--   - Student lesson player (Session C) will finalize the switch + drop lesson_id.
--   - Zero rows means no backfill; each additive column is safely NULL today.
--
-- RLS tightening:
--   - Per-course coach ownership for lesson_placements writes (instructor on
--     the course can manage placements within that course).
--   - Blocks under a lesson: creator + admin for UPDATE/DELETE (D4e=i);
--     coach SELECT kept open.
--   - Lesson UPDATE/DELETE: creator + admin only (D4e=i).
--
-- Applied live via: sudo -u postgres psql -d kunacademy -f 0047_lesson_placements_progress_refactor.sql

BEGIN;

-- ── 1. lesson_progress — add placement_id + idx + partial unique ─────────────
ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS placement_id UUID
  REFERENCES lesson_placements(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_placement
  ON lesson_progress(user_id, placement_id)
  WHERE placement_id IS NOT NULL;

-- Partial unique: each student has at most one progress row per placement.
-- Legacy (lesson_id-based) unique constraint stays until Session C drops lesson_id.
DO $$ BEGIN
  CREATE UNIQUE INDEX lesson_progress_user_placement_unique
    ON lesson_progress(user_id, placement_id)
    WHERE placement_id IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- ── 2. quiz_attempts — add placement_id ──────────────────────────────────────
-- Nullable: admin-preview attempts + attempts pre-dating placement scoping
-- may have no placement. Student-initiated attempts (Session C) set it.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS placement_id UUID
  REFERENCES lesson_placements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz_placement
  ON quiz_attempts(user_id, quiz_id, placement_id);

-- ── 3. Tightened RLS: per-course coach ownership on lesson_placements ────────
-- Coaches assigned as instructor on a course may manage placements within it.
-- Admin retains full access via lesson_placements_admin (ALL).
DROP POLICY IF EXISTS lesson_placements_coach_course_write ON lesson_placements;
CREATE POLICY lesson_placements_coach_course_write ON lesson_placements
  FOR ALL USING (
    EXISTS (
      SELECT 1
        FROM courses c
        JOIN instructors i ON i.id = c.instructor_id
       WHERE c.id = lesson_placements.course_id
         AND i.profile_id = app_uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM courses c
        JOIN instructors i ON i.id = c.instructor_id
       WHERE c.id = lesson_placements.course_id
         AND i.profile_id = app_uid()
    )
  );

-- ── 4. Tightened RLS: lessons — creator+admin UPDATE/DELETE (D4e=i) ──────────
-- Other coaches still SELECT via existing policies; only the creator
-- (or admin) may mutate the lesson row itself.
DROP POLICY IF EXISTS lessons_creator_update ON lessons;
CREATE POLICY lessons_creator_update ON lessons
  FOR UPDATE USING (
    created_by = app_uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = app_uid()
         AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS lessons_creator_delete ON lessons;
CREATE POLICY lessons_creator_delete ON lessons
  FOR DELETE USING (
    created_by = app_uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = app_uid()
         AND p.role IN ('admin', 'super_admin')
    )
  );

-- Coach INSERT on lessons: any coach/admin may create their own lesson
-- (scope='private' by default; promotable to team_library by creator).
DROP POLICY IF EXISTS lessons_coach_insert ON lessons;
CREATE POLICY lessons_coach_insert ON lessons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = app_uid()
         AND p.role IN ('admin', 'super_admin', 'coach', 'instructor')
    )
    AND (created_by IS NULL OR created_by = app_uid())
  );

-- ── 5. Tightened RLS: lesson_blocks — creator+admin edit ─────────────────────
-- A block's "owner" is the owner of its parent lesson. Coaches may still
-- SELECT any block under a lesson they can see (library browsing). Only
-- the lesson's creator (or admin) may INSERT/UPDATE/DELETE blocks on it.
DROP POLICY IF EXISTS lesson_blocks_creator_insert ON lesson_blocks;
CREATE POLICY lesson_blocks_creator_insert ON lesson_blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
        FROM lessons l
       WHERE l.id = lesson_blocks.lesson_id
         AND (l.created_by = app_uid()
              OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = app_uid() AND p.role IN ('admin','super_admin')))
    )
  );

DROP POLICY IF EXISTS lesson_blocks_creator_update ON lesson_blocks;
CREATE POLICY lesson_blocks_creator_update ON lesson_blocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
        FROM lessons l
       WHERE l.id = lesson_blocks.lesson_id
         AND (l.created_by = app_uid()
              OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = app_uid() AND p.role IN ('admin','super_admin')))
    )
  );

DROP POLICY IF EXISTS lesson_blocks_creator_delete ON lesson_blocks;
CREATE POLICY lesson_blocks_creator_delete ON lesson_blocks
  FOR DELETE USING (
    EXISTS (
      SELECT 1
        FROM lessons l
       WHERE l.id = lesson_blocks.lesson_id
         AND (l.created_by = app_uid()
              OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = app_uid() AND p.role IN ('admin','super_admin')))
    )
  );

-- ── 6. Verification ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count int;
BEGIN
  -- lesson_progress.placement_id exists
  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'lesson_progress' AND column_name = 'placement_id';
  IF NOT FOUND THEN RAISE EXCEPTION '0047: lesson_progress.placement_id missing'; END IF;

  -- quiz_attempts.placement_id exists
  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'quiz_attempts' AND column_name = 'placement_id';
  IF NOT FOUND THEN RAISE EXCEPTION '0047: quiz_attempts.placement_id missing'; END IF;

  -- new RLS policies exist
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE policyname IN (
     'lesson_placements_coach_course_write',
     'lessons_creator_update',
     'lessons_creator_delete',
     'lessons_coach_insert',
     'lesson_blocks_creator_insert',
     'lesson_blocks_creator_update',
     'lesson_blocks_creator_delete'
   );
  IF v_count < 7 THEN RAISE EXCEPTION '0047: new RLS policies incomplete (% of 7)', v_count; END IF;

  RAISE NOTICE '0047 OK: placement_id added to lesson_progress + quiz_attempts; 7 RLS policies tightened';
END $$;

COMMIT;
