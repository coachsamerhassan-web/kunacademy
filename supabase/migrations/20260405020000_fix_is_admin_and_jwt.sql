-- ============================================================================
-- Migration: Fix is_admin() + JWT role claim sync
-- Created: 2026-04-05
-- ============================================================================
-- Changes:
--   1. Extend profiles.role CHECK to allow 'super_admin'
--   2. Fix is_admin() to include super_admin
--   3. Add trigger to sync role → auth.users.app_metadata on insert/update
--   4. Backfill existing profiles into app_metadata
-- ============================================================================

-- ── 1. Extend profiles.role constraint to include super_admin ───────────────
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'provider', 'admin', 'super_admin'));


-- ── 2. Fix is_admin() to include super_admin ────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ── 3. Trigger: sync role to auth.users.app_metadata on change ──────────────
CREATE OR REPLACE FUNCTION sync_role_to_app_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Merge 'role' into raw_app_meta_data without touching other keys
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_role_change ON profiles;
CREATE TRIGGER on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_to_app_metadata();


-- ── 4. Backfill existing profiles → app_metadata ────────────────────────────
-- Runs once; the trigger handles future changes automatically.
UPDATE auth.users u
SET raw_app_meta_data = u.raw_app_meta_data || jsonb_build_object('role', p.role)
FROM profiles p
WHERE u.id = p.id;
