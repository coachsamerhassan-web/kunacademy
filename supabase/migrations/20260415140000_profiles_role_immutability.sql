BEGIN;

-- ================================================================
-- SECURITY FIX — profiles.role self-elevation
-- ================================================================
-- Live reproducer on staging (2026-04-15) showed that any session
-- connected as 'authenticated' OR as 'kunacademy' (the default app
-- role) could UPDATE profiles SET role='admin' WHERE id=app_uid(),
-- then is_admin() returned TRUE in the same transaction. Every
-- is_admin()-gated policy in the DB was silently bypassable.
--
-- Root cause (three concurrent gaps):
--   1. Self-update RLS policy has NULL with_check — no column guard
--   2. authenticated holds column-level UPDATE grant on role
--   3. is_admin() reads profiles.role via app_uid() GUC (forgeable)
--
-- Fix (belt-and-suspenders):
--   Layer 1: REVOKE UPDATE (role) from authenticated
--   Layer 2: BEFORE UPDATE trigger on profiles that blocks any
--            role change unless the current DB role has
--            rolbypassrls=true (i.e. kunacademy_admin or postgres).
--            This covers the authenticated AND kunacademy paths.
--
-- Recon confirmed: all 5 legitimate role-write code paths route
-- through withAdminContext() → kunacademy_admin, so this trigger
-- will not break any existing app code. Admin promotions via
-- /api/admin/users PATCH continue to work.
-- ================================================================

-- Layer 1: column-level REVOKE on role for authenticated
REVOKE UPDATE (role) ON profiles FROM authenticated;
-- anon never had UPDATE but belt-and-suspenders
REVOKE UPDATE (role) ON profiles FROM anon;

-- Layer 2: trigger-based immutability gate
CREATE OR REPLACE FUNCTION public.prevent_role_self_elevation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_bypass BOOLEAN;
BEGIN
  -- Only fire the expensive check when role actually changes
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    SELECT rolbypassrls INTO v_bypass
    FROM pg_roles
    WHERE rolname = current_user;

    IF NOT COALESCE(v_bypass, FALSE) THEN
      RAISE EXCEPTION
        'profiles.role is immutable for non-BYPASSRLS roles (current: %, attempted: % -> %)',
        current_user, OLD.role, NEW.role
        USING HINT = 'Admin role changes must connect as kunacademy_admin or service_role (see withAdminContext() in apps/web/src/lib)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach the trigger, only firing on UPDATEs that touch the role column
DROP TRIGGER IF EXISTS profiles_role_immutability ON profiles;
CREATE TRIGGER profiles_role_immutability
BEFORE UPDATE OF role ON profiles
FOR EACH ROW
WHEN (OLD.role IS DISTINCT FROM NEW.role)
EXECUTE FUNCTION public.prevent_role_self_elevation();

-- ================================================================
-- Smoke tests — all inside this transaction, auto-rollback on failure
-- ================================================================

-- SMOKE 1: The trigger blocks an authenticated-role attempt
DO $$
DECLARE
  v_caught TEXT;
BEGIN
  BEGIN
    -- Save the existing role of a known test persona
    PERFORM pg_advisory_xact_lock(hashtext('smoke-test-1'));

    SET LOCAL ROLE authenticated;
    SET LOCAL "app.current_user_id" = '22222222-0000-0000-0000-000000000002';
    UPDATE profiles SET role = 'admin' WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;

    -- We should never reach here
    RAISE EXCEPTION 'SMOKE TEST 1 FAILED: authenticated role was able to update profiles.role';
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_caught := 'insufficient_privilege (column grant revoke fired first)';
    WHEN raise_exception THEN
      v_caught := SQLERRM;
  END;

  RESET ROLE;
  RAISE NOTICE 'SMOKE TEST 1 PASSED: authenticated blocked with %', v_caught;
END $$;

-- SMOKE 2: The trigger blocks a kunacademy-role attempt
DO $$
DECLARE
  v_caught TEXT;
BEGIN
  BEGIN
    SET LOCAL ROLE kunacademy;
    SET LOCAL "app.current_user_id" = '22222222-0000-0000-0000-000000000002';
    UPDATE profiles SET role = 'admin' WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;

    RAISE EXCEPTION 'SMOKE TEST 2 FAILED: kunacademy role was able to update profiles.role';
  EXCEPTION
    WHEN raise_exception THEN
      v_caught := SQLERRM;
  END;

  RESET ROLE;
  RAISE NOTICE 'SMOKE TEST 2 PASSED: kunacademy blocked with %', v_caught;
END $$;

-- SMOKE 3: kunacademy_admin (BYPASSRLS) can still update (positive control)
-- Switch to kunacademy_admin, update to 'admin', verify it applied, then restore original role.
-- All inside this transaction — the outer COMMIT persists everything, which is fine since we
-- restore the original role value at the end.
DO $$
DECLARE
  v_old TEXT;
  v_new TEXT;
BEGIN
  SELECT role INTO v_old FROM profiles WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;

  SET LOCAL ROLE kunacademy_admin;
  UPDATE profiles SET role = 'admin' WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;
  SELECT role INTO v_new FROM profiles WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;

  IF v_new IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'SMOKE TEST 3 FAILED: kunacademy_admin could not set role to admin (got %)', v_new;
  END IF;

  -- Restore original role so we leave the test row clean
  UPDATE profiles SET role = v_old WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;
  RESET ROLE;

  RAISE NOTICE 'SMOKE TEST 3 PASSED: kunacademy_admin successfully updated role (% -> admin -> % restored)', v_old, v_old;
END $$;

-- SMOKE 4: Updates to non-role columns are unaffected (ordinary profile edits)
-- Switch to kunacademy (non-BYPASSRLS), update full_name_en, verify it applied, restore.
DO $$
DECLARE
  v_old TEXT;
  v_new TEXT;
BEGIN
  SELECT full_name_en INTO v_old FROM profiles WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;

  SET LOCAL ROLE kunacademy;
  UPDATE profiles SET full_name_en = 'Smoke Test Name' WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;
  SELECT full_name_en INTO v_new FROM profiles WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;

  IF v_new IS DISTINCT FROM 'Smoke Test Name' THEN
    RAISE EXCEPTION 'SMOKE TEST 4 FAILED: non-role update did not apply (got %)', v_new;
  END IF;

  -- Restore original name
  RESET ROLE;
  UPDATE profiles SET full_name_en = v_old WHERE id = '22222222-0000-0000-0000-000000000002'::uuid;

  RAISE NOTICE 'SMOKE TEST 4 PASSED: non-role column updates unaffected by trigger (name restored to %)', v_old;
END $$;

COMMIT;
