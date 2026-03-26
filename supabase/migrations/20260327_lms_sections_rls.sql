-- ============================================================================
-- Kun Academy — LMS Foundation Migration
-- Created: 2026-03-27
-- Adds: course_sections table, lesson sectioning, preview flag
-- Fixes: lessons RLS (was public, now enrollment-gated)
-- ============================================================================

-- ============================================================================
-- 1. COURSE SECTIONS (group lessons into chapters/modules)
-- ============================================================================
CREATE TABLE course_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title_ar    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  "order"     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE course_sections ENABLE ROW LEVEL SECURITY;

-- Sections follow same visibility as course (published courses = public section titles)
CREATE POLICY "sections_public_select" ON course_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courses c WHERE c.id = course_id AND c.is_published = true
    )
  );
CREATE POLICY "sections_admin" ON course_sections
  FOR ALL USING (is_admin());

-- ============================================================================
-- 2. ADD COLUMNS TO LESSONS
-- ============================================================================
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_provider TEXT CHECK (video_provider IN ('bunny', 'youtube', 'vimeo', 'direct')),
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- ============================================================================
-- 3. FIX LESSONS RLS — was "Public can read lessons" (SECURITY ISSUE)
-- Video URLs must NOT be visible to unauthenticated/unenrolled users
-- ============================================================================

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can read lessons" ON lessons;

-- New policy: lesson metadata (titles, order, duration) visible on published courses
-- But video_url/content only accessible to enrolled users
-- We use a view approach: the policy allows SELECT but a helper function
-- strips sensitive fields for non-enrolled users.

-- For now, we split into two policies:
-- 1. Preview lessons on published courses = fully public (titles + video)
-- 2. Non-preview lessons = enrolled users + admins only

CREATE POLICY "lessons_preview_public" ON lessons
  FOR SELECT USING (
    is_preview = true AND EXISTS (
      SELECT 1 FROM courses c WHERE c.id = course_id AND c.is_published = true
    )
  );

CREATE POLICY "lessons_enrolled_select" ON lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = lessons.course_id
        AND e.user_id = auth.uid()
        AND e.status IN ('enrolled', 'in_progress', 'completed')
    )
  );

-- Admin policy already exists from initial migration, keep it:
-- "Admins full access on lessons" ON lessons FOR ALL USING (is_admin())

-- ============================================================================
-- 4. LESSON TITLES VIEW (public-safe — no video URLs, for course catalog)
-- Shows all lesson titles/order for published courses (syllabus display)
-- ============================================================================
CREATE OR REPLACE VIEW lesson_syllabus AS
SELECT
  l.id,
  l.course_id,
  l.section_id,
  l.title_ar,
  l.title_en,
  l."order",
  l.duration_minutes,
  l.is_preview,
  l.description_ar,
  l.description_en
FROM lessons l
JOIN courses c ON c.id = l.course_id
WHERE c.is_published = true;

-- Grant public read on the view (no video URLs exposed)
GRANT SELECT ON lesson_syllabus TO anon, authenticated;

-- ============================================================================
-- 5. ADD TOTAL LESSONS COUNT + VIDEO DURATION TO COURSES
-- ============================================================================
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS total_lessons INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_video_minutes INTEGER DEFAULT 0;

-- ============================================================================
-- 6. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_course_sections_course ON course_sections(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons(section_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course_order ON lessons(course_id, "order");
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course ON enrollments(user_id, course_id);
