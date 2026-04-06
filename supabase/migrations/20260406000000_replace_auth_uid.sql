-- ============================================================================
-- Migration: Replace auth.uid() with app_uid() for Auth.js migration
-- Created: 2026-04-06
-- ============================================================================
-- Context: Migrating from Supabase Auth to Auth.js on self-hosted PostgreSQL.
--          Supabase's auth.uid() reads from the JWT; on plain Postgres it doesn't
--          exist. app_uid() reads the same identity from a session variable that
--          the application sets via SET LOCAL before every authenticated query.
--
-- How the application must call this:
--   BEGIN;
--   SET LOCAL app.current_user_id = '<uuid>';
--   -- your query here --
--   COMMIT;
--
-- NOTE: auth.users FK references (on profiles.id, bookings.held_by,
--       event_registrations.user_id, pathfinder_responses.user_id) are
--       intentionally NOT changed here — those are schema-level FKs that
--       must be handled in the wider Auth.js schema migration (replace
--       auth.users with a local users table).
-- ============================================================================


-- ============================================================================
-- 1. CREATE app_uid() FUNCTION
-- ============================================================================

-- app_uid() replaces auth.uid() for self-hosted PostgreSQL.
-- The application sets app.current_user_id via SET LOCAL before each query.
CREATE OR REPLACE FUNCTION app_uid() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;


-- ============================================================================
-- 2. REPLACE is_admin() — use app_uid() instead of auth.uid()
--    Latest definition is from 20260405020000_fix_is_admin_and_jwt.sql:
--    includes both 'admin' and 'super_admin' roles.
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = app_uid()
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- 3. RLS POLICY REPLACEMENTS
--    Grouped by table. Each block drops the old policy and recreates it with
--    app_uid() in place of auth.uid().
--    Source migration noted in comments for traceability.
-- ============================================================================


-- ── profiles ─────────────────────────────────────────────────────────────────
-- Source: 20260324010000_initial_schema.sql
-- Source: 20260331000000_fix_coach_booking_profiles.sql

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = app_uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = app_uid());

DROP POLICY IF EXISTS "Providers can read profiles of their booking customers" ON profiles;
CREATE POLICY "Providers can read profiles of their booking customers"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT b.customer_id
      FROM bookings b
      INNER JOIN providers p ON p.id = b.provider_id
      WHERE p.profile_id = app_uid()
    )
  );


-- ── enrollments ──────────────────────────────────────────────────────────────
-- Source: 20260324010000_initial_schema.sql
-- Source: 20260330000000_lms_fixes.sql

DROP POLICY IF EXISTS "Users can read own enrollments" ON enrollments;
CREATE POLICY "Users can read own enrollments"
  ON enrollments FOR SELECT
  USING (user_id = app_uid());

DROP POLICY IF EXISTS "Users can enroll themselves" ON enrollments;
CREATE POLICY "Users can enroll themselves"
  ON enrollments FOR INSERT
  WITH CHECK (user_id = app_uid());

DROP POLICY IF EXISTS "Users can update own enrollment" ON enrollments;
CREATE POLICY "Users can update own enrollment"
  ON enrollments FOR UPDATE
  USING (user_id = app_uid());


-- ── bookings ─────────────────────────────────────────────────────────────────
-- Source: 20260324010000_initial_schema.sql
-- Source: 20260404000000_booking_cancel_rls.sql

DROP POLICY IF EXISTS "Customers can read own bookings" ON bookings;
CREATE POLICY "Customers can read own bookings"
  ON bookings FOR SELECT
  USING (customer_id = app_uid());

DROP POLICY IF EXISTS "Providers can read their bookings" ON bookings;
CREATE POLICY "Providers can read their bookings"
  ON bookings FOR SELECT
  USING (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = app_uid()
    )
  );

DROP POLICY IF EXISTS "Customers can update own bookings" ON bookings;
CREATE POLICY "Customers can update own bookings"
  ON bookings FOR UPDATE
  USING (customer_id = app_uid())
  WITH CHECK (customer_id = app_uid());


-- ── orders ───────────────────────────────────────────────────────────────────
-- Source: 20260324010000_initial_schema.sql

DROP POLICY IF EXISTS "Users can read own orders" ON orders;
CREATE POLICY "Users can read own orders"
  ON orders FOR SELECT
  USING (customer_id = app_uid());


-- ── order_items ──────────────────────────────────────────────────────────────
-- Source: 20260324010000_initial_schema.sql

DROP POLICY IF EXISTS "Users can read own order items" ON order_items;
CREATE POLICY "Users can read own order items"
  ON order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = app_uid()
    )
  );


-- ── payments ─────────────────────────────────────────────────────────────────
-- Source: 20260324010000_initial_schema.sql

DROP POLICY IF EXISTS "Users can read own payments" ON payments;
CREATE POLICY "Users can read own payments"
  ON payments FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = app_uid())
    OR
    booking_id IN (SELECT id FROM bookings WHERE customer_id = app_uid())
  );


-- ── instructor_drafts ────────────────────────────────────────────────────────
-- Source: 20260324010000_initial_schema.sql

DROP POLICY IF EXISTS "Coaches can read own drafts" ON instructor_drafts;
CREATE POLICY "Coaches can read own drafts"
  ON instructor_drafts FOR SELECT
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE profile_id = app_uid()
    )
  );

DROP POLICY IF EXISTS "Coaches can insert own drafts" ON instructor_drafts;
CREATE POLICY "Coaches can insert own drafts"
  ON instructor_drafts FOR INSERT
  WITH CHECK (
    instructor_id IN (
      SELECT id FROM instructors WHERE profile_id = app_uid()
    )
  );

DROP POLICY IF EXISTS "Coaches can update own pending drafts" ON instructor_drafts;
CREATE POLICY "Coaches can update own pending drafts"
  ON instructor_drafts FOR UPDATE
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE profile_id = app_uid()
    )
    AND status = 'pending'
  );


-- ── lesson_progress ──────────────────────────────────────────────────────────
-- Source: 20260324020000_ems_schema.sql

DROP POLICY IF EXISTS "lesson_progress_own_select" ON lesson_progress;
CREATE POLICY "lesson_progress_own_select"
  ON lesson_progress FOR SELECT
  USING (user_id = app_uid());

DROP POLICY IF EXISTS "lesson_progress_own_upsert" ON lesson_progress;
CREATE POLICY "lesson_progress_own_upsert"
  ON lesson_progress FOR INSERT
  WITH CHECK (user_id = app_uid());

DROP POLICY IF EXISTS "lesson_progress_own_update" ON lesson_progress;
CREATE POLICY "lesson_progress_own_update"
  ON lesson_progress FOR UPDATE
  USING (user_id = app_uid());


-- ── attendance ───────────────────────────────────────────────────────────────
-- Source: 20260324020000_ems_schema.sql

DROP POLICY IF EXISTS "attendance_own_select" ON attendance;
CREATE POLICY "attendance_own_select"
  ON attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = enrollment_id AND e.user_id = app_uid()
    )
  );


-- ── materials ────────────────────────────────────────────────────────────────
-- Source: 20260324020000_ems_schema.sql
-- Note: is_admin() call inside USING is covered by the is_admin() fix above.

DROP POLICY IF EXISTS "materials_enrolled_select" ON materials;
CREATE POLICY "materials_enrolled_select"
  ON materials FOR SELECT
  USING (
    is_published = true AND (
      EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.course_id = materials.course_id AND e.user_id = app_uid()
      )
      OR is_admin()
    )
  );


-- ── certificates ─────────────────────────────────────────────────────────────
-- Source: 20260324020000_ems_schema.sql

DROP POLICY IF EXISTS "certificates_own_select" ON certificates;
CREATE POLICY "certificates_own_select"
  ON certificates FOR SELECT
  USING (user_id = app_uid());


-- ── coach_schedules ──────────────────────────────────────────────────────────
-- Source: 20260324020000_ems_schema.sql

DROP POLICY IF EXISTS "coach_schedules_own_manage" ON coach_schedules;
CREATE POLICY "coach_schedules_own_manage"
  ON coach_schedules FOR ALL
  USING (coach_id = app_uid());


-- ── coach_time_off ───────────────────────────────────────────────────────────
-- Source: 20260324020000_ems_schema.sql

DROP POLICY IF EXISTS "coach_time_off_own_manage" ON coach_time_off;
CREATE POLICY "coach_time_off_own_manage"
  ON coach_time_off FOR ALL
  USING (coach_id = app_uid());


-- ── community_boards ─────────────────────────────────────────────────────────
-- Source: 20260324020000_ems_schema.sql

DROP POLICY IF EXISTS "boards_general_select" ON community_boards;
CREATE POLICY "boards_general_select"
  ON community_boards FOR SELECT
  USING (
    type IN ('general', 'announcements')
    OR EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = community_boards.id AND bm.user_id = app_uid()
    )
    OR is_admin()
  );


-- ── community_posts ──────────────────────────────────────────────────────────
-- Source: 20260324020000_ems_schema.sql

DROP POLICY IF EXISTS "posts_board_member_select" ON community_posts;
CREATE POLICY "posts_board_member_select"
  ON community_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_boards b
      WHERE b.id = board_id AND (
        b.type IN ('general', 'announcements')
        OR EXISTS (
          SELECT 1 FROM board_members bm
          WHERE bm.board_id = b.id AND bm.user_id = app_uid()
        )
      )
    )
    OR is_admin()
  );

DROP POLICY IF EXISTS "posts_member_insert" ON community_posts;
CREATE POLICY "posts_member_insert"
  ON community_posts FOR INSERT
  WITH CHECK (
    author_id = app_uid() AND (
      EXISTS (
        SELECT 1 FROM community_boards b
        WHERE b.id = board_id AND (
          (b.type IN ('general', 'announcements') AND NOT b.is_admin_only)
          OR EXISTS (
            SELECT 1 FROM board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = app_uid()
          )
        )
      )
      OR is_admin()
    )
  );

DROP POLICY IF EXISTS "posts_own_update" ON community_posts;
CREATE POLICY "posts_own_update"
  ON community_posts FOR UPDATE
  USING (author_id = app_uid());


-- ── community_reactions ──────────────────────────────────────────────────────
-- Source: 20260324020000_ems_schema.sql

DROP POLICY IF EXISTS "reactions_own_manage" ON community_reactions;
CREATE POLICY "reactions_own_manage"
  ON community_reactions FOR INSERT
  WITH CHECK (user_id = app_uid());

DROP POLICY IF EXISTS "reactions_own_delete" ON community_reactions;
CREATE POLICY "reactions_own_delete"
  ON community_reactions FOR DELETE
  USING (user_id = app_uid());


-- ── coach_ratings ────────────────────────────────────────────────────────────
-- Source: 20260324030000_v2_remaining.sql

DROP POLICY IF EXISTS "coach_ratings_own_select" ON coach_ratings;
CREATE POLICY "coach_ratings_own_select"
  ON coach_ratings FOR SELECT
  USING (user_id = app_uid() OR coach_id = app_uid());

DROP POLICY IF EXISTS "coach_ratings_own_insert" ON coach_ratings;
CREATE POLICY "coach_ratings_own_insert"
  ON coach_ratings FOR INSERT
  WITH CHECK (
    user_id = app_uid()
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.customer_id = app_uid()
        AND b.status = 'completed'
    )
  );


-- ── referral_codes ───────────────────────────────────────────────────────────
-- Source: 20260324030000_v2_remaining.sql

DROP POLICY IF EXISTS "referral_codes_own_select" ON referral_codes;
CREATE POLICY "referral_codes_own_select"
  ON referral_codes FOR SELECT
  USING (user_id = app_uid());


-- ── credit_transactions ──────────────────────────────────────────────────────
-- Source: 20260324030000_v2_remaining.sql

DROP POLICY IF EXISTS "credits_own_select" ON credit_transactions;
CREATE POLICY "credits_own_select"
  ON credit_transactions FOR SELECT
  USING (user_id = app_uid());


-- ── blog_posts ───────────────────────────────────────────────────────────────
-- Source: 20260324030000_v2_remaining.sql

DROP POLICY IF EXISTS "blog_posts_author_select" ON blog_posts;
CREATE POLICY "blog_posts_author_select"
  ON blog_posts FOR SELECT
  USING (author_id = app_uid());


-- ── download_tokens ──────────────────────────────────────────────────────────
-- Source: 20260324030000_v2_remaining.sql

DROP POLICY IF EXISTS "download_tokens_own_select" ON download_tokens;
CREATE POLICY "download_tokens_own_select"
  ON download_tokens FOR SELECT
  USING (user_id = app_uid());


-- ── commission_rates ─────────────────────────────────────────────────────────
-- Source: 20260324030000_v2_remaining.sql (original, scope='profile')
-- Source: 20260326010000_fix_commission_rls.sql (fixed, scope='coach')
-- Only the final version (scope='coach') is reproduced here.

DROP POLICY IF EXISTS "commission_rates_own_select" ON commission_rates;
CREATE POLICY "commission_rates_own_select"
  ON commission_rates FOR SELECT
  USING (
    scope = 'coach' AND scope_id = app_uid()::TEXT
  );


-- ── earnings ─────────────────────────────────────────────────────────────────
-- Source: 20260324030000_v2_remaining.sql

DROP POLICY IF EXISTS "earnings_own_select" ON earnings;
CREATE POLICY "earnings_own_select"
  ON earnings FOR SELECT
  USING (user_id = app_uid());


-- ── payout_requests ──────────────────────────────────────────────────────────
-- Source: 20260324030000_v2_remaining.sql

DROP POLICY IF EXISTS "payouts_own_select" ON payout_requests;
CREATE POLICY "payouts_own_select"
  ON payout_requests FOR SELECT
  USING (user_id = app_uid());

DROP POLICY IF EXISTS "payouts_own_insert" ON payout_requests;
CREATE POLICY "payouts_own_insert"
  ON payout_requests FOR INSERT
  WITH CHECK (user_id = app_uid());


-- ── payment_schedules ────────────────────────────────────────────────────────
-- Source: 20260324030000_v2_remaining.sql

DROP POLICY IF EXISTS "schedules_own_select" ON payment_schedules;
CREATE POLICY "schedules_own_select"
  ON payment_schedules FOR SELECT
  USING (user_id = app_uid());


-- ── book_access ──────────────────────────────────────────────────────────────
-- Source: 20260325000000_book_access.sql

DROP POLICY IF EXISTS "Users read own access" ON book_access;
CREATE POLICY "Users read own access"
  ON book_access FOR SELECT
  USING (app_uid() = user_id);


-- ── lessons ──────────────────────────────────────────────────────────────────
-- Source: 20260327010000_lms_sections_rls.sql

DROP POLICY IF EXISTS "lessons_enrolled_select" ON lessons;
CREATE POLICY "lessons_enrolled_select"
  ON lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = lessons.course_id
        AND e.user_id = app_uid()
        AND e.status IN ('enrolled', 'in_progress', 'completed')
    )
  );


-- ── pathfinder_responses ─────────────────────────────────────────────────────
-- Source: 20260401020000_pathfinder_responses.sql
-- Source: 20260405050000_fix_critical_rls.sql (C2 fix — email path removed from UPDATE)
-- Note on email-lookup: the SELECT and old UPDATE used
--   email = (SELECT email FROM auth.users WHERE id = auth.uid())
-- On self-hosted Postgres there is no auth.users table. The email column
-- lives on the profiles table. The replacement below uses profiles.email.
-- The UPDATE fix (C2) already removed the email path — only user_id = app_uid().

DROP POLICY IF EXISTS "Users can read own pathfinder responses" ON pathfinder_responses;
CREATE POLICY "Users can read own pathfinder responses"
  ON pathfinder_responses FOR SELECT
  USING (
    user_id = app_uid()
    OR email = (SELECT email FROM profiles WHERE id = app_uid())
  );

DROP POLICY IF EXISTS "Admins can read all pathfinder responses" ON pathfinder_responses;
CREATE POLICY "Admins can read all pathfinder responses"
  ON pathfinder_responses FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = app_uid() AND role = 'admin')
  );

-- UPDATE policy (already fixed by C2 in 20260405050000 — reproduced here for completeness)
DROP POLICY IF EXISTS "Users can update own pathfinder responses" ON pathfinder_responses;
CREATE POLICY "Users can update own pathfinder responses"
  ON pathfinder_responses FOR UPDATE
  TO authenticated
  USING (user_id = app_uid())
  WITH CHECK (user_id = app_uid());


-- ── custom_benefit_submissions ───────────────────────────────────────────────
-- Source: 20260402020000_corporate_pathfinder.sql

DROP POLICY IF EXISTS "Admins read custom benefits" ON custom_benefit_submissions;
CREATE POLICY "Admins read custom benefits"
  ON custom_benefit_submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = app_uid() AND role = 'admin')
  );


-- ── waitlist_entries ─────────────────────────────────────────────────────────
-- Source: 20260404010000_event_capacity.sql
-- Note: original used auth.users to look up email. Replaced with profiles.email.

DROP POLICY IF EXISTS "Users can read own waitlist entries" ON waitlist_entries;
CREATE POLICY "Users can read own waitlist entries"
  ON waitlist_entries FOR SELECT
  USING (email = (SELECT email FROM profiles WHERE id = app_uid()));

DROP POLICY IF EXISTS "Admins can read all waitlist entries" ON waitlist_entries;
CREATE POLICY "Admins can read all waitlist entries"
  ON waitlist_entries FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = app_uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can update waitlist entries" ON waitlist_entries;
CREATE POLICY "Admins can update waitlist entries"
  ON waitlist_entries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = app_uid() AND role = 'admin'));


-- ── event_registrations ──────────────────────────────────────────────────────
-- Source: 20260405000000_event_registrations.sql
-- Note: original used auth.users to look up email. Replaced with profiles.email.

DROP POLICY IF EXISTS "Users can read own event registrations" ON event_registrations;
CREATE POLICY "Users can read own event registrations"
  ON event_registrations FOR SELECT
  USING (
    user_id = app_uid()
    OR email = (SELECT email FROM profiles WHERE id = app_uid())
  );

DROP POLICY IF EXISTS "Users can cancel own event registrations" ON event_registrations;
CREATE POLICY "Users can cancel own event registrations"
  ON event_registrations FOR UPDATE
  USING (
    user_id = app_uid()
    OR email = (SELECT email FROM profiles WHERE id = app_uid())
  );

DROP POLICY IF EXISTS "Admins can read all event registrations" ON event_registrations;
CREATE POLICY "Admins can read all event registrations"
  ON event_registrations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = app_uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can update all event registrations" ON event_registrations;
CREATE POLICY "Admins can update all event registrations"
  ON event_registrations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = app_uid() AND role = 'admin'));


-- ── coach_payout_profiles ────────────────────────────────────────────────────
-- Source: 20260405040000_hybrid_payout.sql

DROP POLICY IF EXISTS "Coaches read own payout profile" ON coach_payout_profiles;
CREATE POLICY "Coaches read own payout profile"
  ON coach_payout_profiles
  FOR SELECT
  TO authenticated
  USING (app_uid() = user_id);

DROP POLICY IF EXISTS "Coaches insert own payout profile" ON coach_payout_profiles;
CREATE POLICY "Coaches insert own payout profile"
  ON coach_payout_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (app_uid() = user_id);

DROP POLICY IF EXISTS "Coaches update own payout profile" ON coach_payout_profiles;
CREATE POLICY "Coaches update own payout profile"
  ON coach_payout_profiles
  FOR UPDATE
  TO authenticated
  USING (app_uid() = user_id);


-- ── digital_assets ───────────────────────────────────────────────────────────
-- Source: 20260405050000_fix_critical_rls.sql (FIX C3)

DROP POLICY IF EXISTS "Purchasers can view digital assets" ON digital_assets;
CREATE POLICY "Purchasers can view digital assets"
  ON digital_assets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.customer_id = app_uid()
        AND o.status = 'completed'
        AND oi.product_id = digital_assets.product_id
    )
    OR
    EXISTS (
      SELECT 1
      FROM download_tokens dt
      WHERE dt.user_id = app_uid()
        AND dt.asset_id = digital_assets.id
    )
  );


-- ============================================================================
-- 4. NOTES FOR REMAINING auth.users REFERENCES
-- ============================================================================
-- The following auth.users references are NOT replaced by this migration.
-- They require a separate schema migration to create a local `users` table
-- (or equivalent) as part of the full Auth.js integration:
--
--   - profiles.id REFERENCES auth.users ON DELETE CASCADE
--       → 20260324010000_initial_schema.sql:15
--       → Will become: REFERENCES users(id) ON DELETE CASCADE
--
--   - handle_new_user() trigger on auth.users INSERT
--       → 20260324010000_initial_schema.sql:454-470
--       → Will be replaced by Auth.js onSignIn callback
--
--   - sync_role_to_app_metadata() + backfill UPDATE on auth.users
--       → 20260405020000_fix_is_admin_and_jwt.sql:37,53
--       → Will be replaced by Auth.js session callback (role in JWT claim)
--
--   - bookings.held_by REFERENCES auth.users(id)
--       → 20260402010000_booking_enhancements.sql:15
--
--   - event_registrations.user_id REFERENCES auth.users(id)
--       → 20260405000000_event_registrations.sql:7
--
--   - pathfinder_responses.user_id REFERENCES auth.users(id)
--       → 20260401020000_pathfinder_responses.sql:9
-- ============================================================================
