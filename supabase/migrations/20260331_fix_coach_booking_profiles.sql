-- ============================================================================
-- Fix: Coach can read basic profile info for their own bookings' customers
-- Problem: profiles RLS only allows users to read their OWN profile.
--          When a coach (provider) queries bookings with a joined profiles
--          relation, Supabase returns null for the customer field because the
--          coach's auth.uid() != customer's profile id — RLS silently blocks.
-- Solution: Add a SELECT policy allowing providers to read profiles of users
--           who have a booking with that provider.
-- Scope: minimal — only exposes full_name_ar, full_name_en, email.
--        The policy cannot restrict columns, but the query only fetches those.
-- ============================================================================

CREATE POLICY "Providers can read profiles of their booking customers"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT b.customer_id
      FROM bookings b
      INNER JOIN providers p ON p.id = b.provider_id
      WHERE p.profile_id = auth.uid()
    )
  );
