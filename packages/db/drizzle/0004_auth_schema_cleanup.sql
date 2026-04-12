-- Migration: Wave S0 Phase 6 — Auth schema cleanup (Supabase legacy removal)
-- Date: 2026-04-11 session 4d (auth fix)
-- Approved by: Samer (destructive migration explicitly authorized)
-- Applied manually on VPS (72.61.110.211) via psql; committed for future deploys.
--
-- ============================================================================
-- Problem
-- ============================================================================
-- Partially-completed Supabase → NextAuth migration left two parallel user
-- tables in the database:
--
--   auth.users          (Supabase legacy, no password_hash, 3 test rows)
--   public.auth_users   (NextAuth-native, has password_hash, 3 test rows)
--
-- Four public tables still had FKs pointing at auth.users:
--   profiles.id                    → auth.users(id) ON DELETE CASCADE
--   bookings.held_by               → auth.users(id)
--   event_registrations.user_id    → auth.users(id) ON DELETE SET NULL
--   pathfinder_responses.user_id   → auth.users(id) ON DELETE SET NULL
--
-- The signup handler (/api/auth/signup) writes to public.auth_users +
-- public.profiles inside withAdminContext (SET LOCAL role = kunacademy_admin).
-- Profiles insert then failed with profiles_id_fkey because the new UUID
-- existed in public.auth_users but not in auth.users.
--
-- kunacademy_admin has BYPASSRLS but no USAGE privilege on the auth schema,
-- so no workaround was possible without dropping the legacy layout.
--
-- ============================================================================
-- Fix
-- ============================================================================
-- 1. Repoint all four FKs at public.auth_users(id)
-- 2. Drop the legacy auth schema (cascades triggers + sync function dependency)
-- 3. Replace public.handle_new_user / sync_role_to_app_metadata with no-ops
--    (both functions currently write to auth.users and must not)
-- 4. Ensure kunacademy_admin has full grants on public.auth_users sequences
--
-- ============================================================================
-- Data safety
-- ============================================================================
-- The three existing rows in auth.users share their UUIDs 1:1 with existing
-- rows in public.auth_users and public.profiles (all three test fixture
-- accounts: admin/coach/client@kunacademy.test). Repointing the FK is
-- therefore a no-op on existing data — every profile.id already has a valid
-- parent in public.auth_users.
--
-- Pre-flight row counts (verified 2026-04-11 21:40):
--   auth.users:           3 rows (all test fixtures, to be dropped)
--   public.auth_users:    3 rows (same IDs, password_hash populated)
--   public.profiles:      3 rows (same IDs)
--   bookings.held_by:            0 non-null rows
--   event_registrations.user_id: 0 non-null rows
--   pathfinder_responses.user_id: 0 non-null rows
--
-- Backups taken before apply:
--   /tmp/phase6-auth-backups/auth-schema-20260411-phase6.sql
--   /tmp/phase6-auth-backups/auth-data-20260411-phase6.sql
--   /tmp/phase6-auth-backups/public-auth-users-20260411-phase6.tsv
--   /tmp/phase6-auth-backups/public-profiles-20260411-phase6.tsv
-- ============================================================================

BEGIN;

-- ── 1. Drop the trigger on public.profiles that writes to auth.users.
--      (on_auth_user_created lives on auth.users itself and will go away
--      when we drop the schema in step 3; its dependent function
--      handle_new_user() is then orphaned and dropped with CASCADE below.)

DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_role_to_app_metadata();
-- handle_new_user is dropped later with CASCADE after the trigger on
-- auth.users is gone along with the schema.

-- ── 2. Repoint all FKs from auth.users → public.auth_users ─────────────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES public.auth_users(id) ON DELETE CASCADE;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_held_by_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_held_by_fkey
  FOREIGN KEY (held_by) REFERENCES public.auth_users(id);

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_user_id_fkey;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;

ALTER TABLE public.pathfinder_responses
  DROP CONSTRAINT IF EXISTS pathfinder_responses_user_id_fkey;
ALTER TABLE public.pathfinder_responses
  ADD CONSTRAINT pathfinder_responses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;

-- ── 3. Drop the legacy auth schema (cascades to users table, triggers,
--      and the auth.uid/role/jwt shim functions) ──────────────────────────

DROP SCHEMA IF EXISTS auth CASCADE;

-- Drop the now-orphaned handle_new_user function (its trigger went with auth.users).
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ── 4. Ensure kunacademy_admin has all needed privileges on public ─────────
--      (public.auth_users already has arwd; sequences are required for
--      INSERT ... RETURNING id paths, and future tables should inherit.)

GRANT ALL PRIVILEGES ON public.auth_users TO kunacademy_admin;
GRANT ALL PRIVILEGES ON public.profiles TO kunacademy_admin;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO kunacademy_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO kunacademy_admin;

COMMIT;
