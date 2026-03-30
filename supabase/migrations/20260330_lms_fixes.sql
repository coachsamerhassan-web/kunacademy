-- ============================================================================
-- Kun Academy — LMS Fixes Migration
-- Created: 2026-03-30
-- Fixes: enrollment unique constraint, enrollment insert RLS
-- ============================================================================

-- 1. Unique constraint on enrollments (user_id, course_id)
-- Required for upsert in Stripe webhook + payment webhook
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_user_course_unique
  ON enrollments(user_id, course_id);

-- 2. Allow authenticated users to insert enrollments (for webhook service_role
--    and for future self-enrollment on free courses)
--    Note: The service_role key bypasses RLS, but for free course self-enrollment
--    we need an INSERT policy.
CREATE POLICY "Users can enroll themselves"
  ON enrollments FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Allow users to update their own enrollment (status changes via progress API)
CREATE POLICY "Users can update own enrollment"
  ON enrollments FOR UPDATE USING (user_id = auth.uid());
