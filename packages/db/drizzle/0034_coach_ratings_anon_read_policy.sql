-- Migration 0034 — Coach Ratings anon read policy (defense-in-depth)
--
-- Wave: RLS-HARDENING (2026-04-21)
-- Follows the privacy-column drop (commit 4e94eab). The public read model is
-- now simply: is_published = true ⇒ displayable to the world.
--
-- Adds an explicit SELECT policy for the `anon` role so public GET endpoints
-- can drop `withAdminContext` and rely on RLS — belt-and-suspenders if a
-- WHERE-clause ever regresses.
--
-- Existing policies on public.coach_ratings (confirmed live pre-migration):
--   coach_ratings_public_select  — permissive SELECT to public role, USING (is_published = true)
--   coach_ratings_admin          — ALL to public role, USING is_admin()
--   coach_ratings_own_select     — SELECT to public role, USING user_id/coach_id = app_uid()
--   coach_ratings_own_insert     — INSERT to public role, WITH CHECK (user_id = app_uid() AND booking completed)
--
-- This migration adds a 5th policy explicitly scoped to the `anon` role.
-- RLS is already enabled on the table; we reaffirm it idempotently.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY. Re-runnable.

-- Reaffirm RLS enabled (no-op if already on)
ALTER TABLE public.coach_ratings ENABLE ROW LEVEL SECURITY;

-- Drop-and-create for idempotency (PG < 16 has no CREATE POLICY IF NOT EXISTS)
DROP POLICY IF EXISTS coach_ratings_anon_public_read ON public.coach_ratings;

CREATE POLICY coach_ratings_anon_public_read
  ON public.coach_ratings
  FOR SELECT
  TO anon
  USING (is_published = true);

-- Ensure the anon role can actually reach the table (SELECT grant). The table
-- already shows `anon=r/kunacademy` in access privileges but we reaffirm here
-- so the migration is self-contained if re-applied on a fresh clone.
GRANT SELECT ON public.coach_ratings TO anon;

-- Also ensure the app role kunacademy keeps SELECT (public GET routes will
-- drop withAdminContext and run as the default pool role). No change expected
-- — this is a no-op if already granted.
GRANT SELECT ON public.coach_ratings TO kunacademy;

-- Verify block (for migration log readability; no-op output)
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policy
  WHERE polrelid = 'public.coach_ratings'::regclass;
  RAISE NOTICE '[migration 0034] coach_ratings now has % policies', policy_count;
END $$;
