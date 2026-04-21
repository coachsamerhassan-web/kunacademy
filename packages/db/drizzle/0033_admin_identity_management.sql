-- Migration 0033 — Admin Identity & Role Management
--
-- Wave: ADMIN-IDENTITY-MGMT (2026-04-21)
-- Enables admins to create users in any role, change roles with audit, and
-- manage invited/deactivated states.
--
-- Changes:
--   1. Extend profiles_role_check to include 'mentor', 'apprentice', 'assessor'
--      (coach-track roles already used implicitly by other tables; formalizing
--       them here so the admin UI can assign them safely).
--   2. Add profiles.status column — 'active' | 'invited' | 'deactivated'.
--      Existing rows default to 'active'. 'invited' = admin-created pending
--      first login. 'deactivated' = reversible soft-disable.
--   3. Create profile_role_changes audit table — immutable log of every role
--      transition (who, when, old→new, reason?).
--
-- Idempotent: uses DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT, ADD COLUMN IF
-- NOT EXISTS, and CREATE TABLE IF NOT EXISTS, so it can be re-run safely.

-- ── 1. Role whitelist expansion ───────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'provider', 'admin', 'super_admin',
                  'mentor',  'apprentice', 'assessor'));

-- ── 2. profiles.status ────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'invited', 'deactivated'));

CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- ── 3. Role-change audit table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_role_changes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_role     text,               -- null for initial assignment at create
  new_role     text NOT NULL,
  changed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reason       text,
  changed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_role_changes_user
  ON profile_role_changes(user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_role_changes_by
  ON profile_role_changes(changed_by, changed_at DESC);

-- Ownership + grants (mirrors pattern from earlier migrations; kunacademy role
-- is the app role, kunacademy_admin is the BYPASSRLS role used by
-- withAdminContext). RLS policies intentionally omitted: audit log is
-- admin-only and never read via app_uid() contexts.
ALTER TABLE profile_role_changes OWNER TO kunacademy_admin;
GRANT SELECT, INSERT ON profile_role_changes TO kunacademy;
GRANT SELECT, INSERT ON profile_role_changes TO kunacademy_admin;

-- ── Notes ─────────────────────────────────────────────────────────────────────
-- profiles_role_immutability trigger still applies — non-BYPASSRLS roles
-- cannot change their own profile.role. Admin writes go through
-- withAdminContext() which uses kunacademy_admin (BYPASSRLS) and bypasses the
-- trigger as designed. No changes to the trigger are required.
