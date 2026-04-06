-- ============================================================================
-- Role Grants for Self-Hosted PostgreSQL
-- Created: 2026-04-06
-- ============================================================================
-- Supabase handles these grants implicitly on managed instances.
-- On self-hosted PostgreSQL the roles (authenticated, anon, service_role)
-- exist but have NO table-level privileges until explicitly granted here.
--
-- Grant logic derived from actual RLS policies across all migrations:
--   20260324010000_initial_schema.sql
--   20260324020000_ems_schema.sql
--   20260324030000_v2_remaining.sql
--   20260325000000_book_access.sql
--   20260327010000_lms_sections_rls.sql
--   20260401020000_pathfinder_responses.sql
--   20260402020000_corporate_pathfinder.sql
--   20260404010000_event_capacity.sql
--   20260405000000_event_registrations.sql
--   20260405010000_admin_audit_log.sql
--   20260405030000_webhook_events.sql
--   20260405040000_hybrid_payout.sql
--   20260405050000_fix_critical_rls.sql
--   20260406000000_replace_auth_uid.sql
-- ============================================================================


-- ============================================================================
-- service_role: full access (used by webhooks, cron, admin operations)
-- These tables must be writable by the backend without going through RLS
-- ============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;


-- ============================================================================
-- authenticated: table-level grants matching RLS policies
-- A GRANT is the outer gate; the RLS policy is the inner filter.
-- Every operation allowed by any RLS policy for `authenticated` must have
-- a corresponding GRANT, otherwise PostgreSQL blocks before even checking RLS.
-- ============================================================================

-- ── SELECT grants ─────────────────────────────────────────────────────────────
-- Every table where at least one SELECT policy applies to authenticated users.
--
-- profiles            → "Users can read own profile" + "Providers can read booking customers"
-- bookings            → "Customers can read own bookings" + "Providers can read their bookings"
-- courses             → "Public can read published courses" (public policy, but authenticated must also pass)
-- course_sections     → "sections_public_select"
-- lessons             → "lessons_preview_public" + "lessons_enrolled_select"
-- lesson_progress     → "lesson_progress_own_select"
-- enrollments         → "Users can read own enrollments"
-- services            → "Public can read active services"
-- service_categories  → "service_categories_public"
-- products            → "Public can read active products"
-- orders              → "Users can read own orders"
-- order_items         → "Users can read own order items"
-- payments            → "Users can read own payments"
-- payment_schedules   → "schedules_own_select"
-- digital_assets      → "Purchasers can view digital assets"
-- download_tokens     → "download_tokens_own_select"
-- earnings            → "earnings_own_select"
-- payout_requests     → "payouts_own_select"
-- coach_payout_profiles → "Coaches read own payout profile"
-- coach_schedules     → "coach_schedules_public_select" (is_active = true)
-- coach_time_off      → "coach_time_off_public_select" (always true)
-- coach_badges        → "coach_badges_public_select" (always true)
-- coach_ratings       → "coach_ratings_public_select" + "coach_ratings_own_select"
-- commission_rates    → "commission_rates_own_select"
-- community_boards    → "boards_general_select"
-- community_posts     → "posts_board_member_select"
-- community_reactions → "reactions_select" (always true)
-- board_members       → "board_members_select" (always true)
-- blog_posts          → "blog_posts_public_select" + "blog_posts_author_select"
-- testimonials        → "Public can read testimonials" (always true)
-- certificates        → "certificates_own_select"
-- materials           → "materials_enrolled_select"
-- book_access         → "Users read own access"
-- providers           → "Public can read visible providers"
-- instructors         → "Public can read visible instructors"
-- referral_codes      → "referral_codes_own_select"
-- event_registrations → "Users can read own event registrations"
-- pathfinder_responses→ "Users can read own pathfinder responses" + admin policy
-- waitlist_entries    → "Users can read own waitlist entries"
-- attendance          → "attendance_own_select"
-- posts               → "Public can read published posts"
-- instructor_drafts   → "Coaches can read own drafts"
-- credit_transactions → "credits_own_select"
-- custom_benefit_submissions → "Admins read custom benefits" (admin-only but still needs GRANT)
-- admin_audit_log     → "Admins can read audit logs"
-- webhook_events      → "Admins can view webhook events"
-- availability        → "Public can read active availability" (table not yet in DB — skip)

GRANT SELECT ON
  profiles,
  bookings,
  courses,
  course_sections,
  lessons,
  lesson_progress,
  enrollments,
  services,
  service_categories,
  products,
  orders,
  order_items,
  payments,
  payment_schedules,
  digital_assets,
  download_tokens,
  earnings,
  payout_requests,
  coach_payout_profiles,
  coach_schedules,
  coach_time_off,
  coach_badges,
  coach_ratings,
  commission_rates,
  community_boards,
  community_posts,
  community_reactions,
  board_members,
  blog_posts,
  testimonials,
  certificates,
  materials,
  book_access,
  providers,
  instructors,
  referral_codes,
  event_registrations,
  pathfinder_responses,
  waitlist_entries,
  attendance,
  posts,
  instructor_drafts,
  credit_transactions,
  custom_benefit_submissions,
  admin_audit_log,
  webhook_events
TO authenticated;


-- ── INSERT grants ─────────────────────────────────────────────────────────────
-- Tables where authenticated users can create records via RLS policy.
--
-- enrollments         → "Users can enroll themselves"
-- bookings            → (no direct user INSERT policy; bookings are created server-side)
-- lesson_progress     → "lesson_progress_own_upsert"
-- community_posts     → "posts_member_insert"
-- community_reactions → "reactions_own_manage"
-- board_members       → (admin-only inserts, but authenticated needs GRANT for admin path)
-- coach_ratings       → "coach_ratings_own_insert"
-- coach_schedules     → covered by FOR ALL "coach_schedules_own_manage"
-- coach_time_off      → covered by FOR ALL "coach_time_off_own_manage"
-- pathfinder_responses→ "Anyone can submit pathfinder response" (public, but authenticated also hits this)
-- event_registrations → "Anyone can register for events"
-- waitlist_entries    → "Anyone can join event waitlist"
-- orders              → (server-side only; but admin policy covers)
-- order_items         → (server-side only)
-- payout_requests     → "payouts_own_insert"
-- referral_codes      → (admin-only creates, but authenticated admin still needs GRANT)
-- posts               → admin FOR ALL
-- instructor_drafts   → "Coaches can insert own drafts"
-- coach_payout_profiles → "Coaches insert own payout profile"
-- custom_benefit_submissions → "Public insert custom benefits"
-- attendance          → admin FOR ALL
-- book_access         → "Service role insert" (authenticated admin path needs it)

GRANT INSERT ON
  enrollments,
  bookings,
  lesson_progress,
  community_posts,
  community_reactions,
  board_members,
  coach_ratings,
  coach_schedules,
  coach_time_off,
  pathfinder_responses,
  event_registrations,
  waitlist_entries,
  orders,
  order_items,
  payout_requests,
  referral_codes,
  posts,
  instructor_drafts,
  coach_payout_profiles,
  custom_benefit_submissions,
  attendance,
  book_access
TO authenticated;


-- ── UPDATE grants ─────────────────────────────────────────────────────────────
-- Tables where authenticated users can update records via RLS policy.
--
-- profiles            → "Users can update own profile"
-- bookings            → "Customers can update own bookings"
-- enrollments         → "Users can update own enrollment"
-- lesson_progress     → "lesson_progress_own_update"
-- community_posts     → "posts_own_update"
-- coach_schedules     → FOR ALL "coach_schedules_own_manage"
-- coach_time_off      → FOR ALL "coach_time_off_own_manage"
-- pathfinder_responses→ "Users can update own pathfinder responses"
-- instructor_drafts   → "Coaches can update own pending drafts"
-- coach_payout_profiles → "Coaches update own payout profile"
-- event_registrations → "Users can cancel own event registrations"
-- waitlist_entries    → "Admins can update waitlist entries" (admin path)
-- posts               → admin FOR ALL

GRANT UPDATE ON
  profiles,
  bookings,
  enrollments,
  lesson_progress,
  community_posts,
  coach_schedules,
  coach_time_off,
  pathfinder_responses,
  instructor_drafts,
  coach_payout_profiles,
  event_registrations,
  waitlist_entries,
  posts
TO authenticated;


-- ── DELETE grants ─────────────────────────────────────────────────────────────
-- Tables where authenticated users can delete records via RLS policy.
--
-- community_posts     → admin FOR ALL
-- community_reactions → "reactions_own_delete"
-- board_members       → admin FOR ALL
-- coach_schedules     → FOR ALL "coach_schedules_own_manage"
-- coach_time_off      → FOR ALL "coach_time_off_own_manage"
-- posts               → admin FOR ALL

GRANT DELETE ON
  community_posts,
  community_reactions,
  board_members,
  coach_schedules,
  coach_time_off,
  posts
TO authenticated;


-- ── Sequence grants ───────────────────────────────────────────────────────────
-- Required for INSERT operations with auto-generated IDs.
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;


-- ============================================================================
-- anon: read-only on truly public content
-- These tables have policies with USING (true) or simple boolean columns,
-- meaning unauthenticated visitors can read them.
-- ============================================================================

-- courses             → "Public can read published courses" (is_published = true)
-- course_sections     → "sections_public_select" (published course check)
-- lessons             → "lessons_preview_public" (is_preview + published course)
-- services            → "Public can read active services" (is_active = true)
-- service_categories  → "service_categories_public" (always true)
-- products            → "Public can read active products" (is_active = true)
-- providers           → "Public can read visible providers" (is_visible = true)
-- instructors         → "Public can read visible instructors" (is_visible = true)
-- testimonials        → "Public can read testimonials" (always true)
-- blog_posts          → "blog_posts_public_select" (is_published = true)
-- coach_badges        → "coach_badges_public_select" (always true)
-- coach_ratings       → "coach_ratings_public_select" (is_published = true)
-- coach_schedules     → "coach_schedules_public_select" (is_active = true)
-- coach_time_off      → "coach_time_off_public_select" (always true — booking engine reads it)
-- community_boards    → "boards_general_select" — general/announcement boards are open
-- community_reactions → "reactions_select" (always true)
-- board_members       → "board_members_select" (always true)
-- posts               → "Public can read published posts"
-- availability        → "Public can read active availability" (table not yet in DB — skip)
-- event_registrations → INSERT only (public registration); no public SELECT
-- pathfinder_responses→ INSERT only (public submission); no public SELECT
-- waitlist_entries    → INSERT only; no public SELECT
-- custom_benefit_submissions → INSERT only; no public SELECT

GRANT SELECT ON
  courses,
  course_sections,
  lessons,
  services,
  service_categories,
  products,
  providers,
  instructors,
  testimonials,
  blog_posts,
  coach_badges,
  coach_ratings,
  coach_schedules,
  coach_time_off,
  community_boards,
  community_reactions,
  board_members,
  posts
TO anon;

-- anon INSERT: public-facing forms that don't require auth
GRANT INSERT ON
  event_registrations,
  pathfinder_responses,
  waitlist_entries,
  custom_benefit_submissions
TO anon;


-- ============================================================================
-- lesson_syllabus VIEW — already granted in 20260327010000_lms_sections_rls.sql
-- Reproduced here for completeness / idempotency
-- ============================================================================
GRANT SELECT ON lesson_syllabus TO anon, authenticated;
