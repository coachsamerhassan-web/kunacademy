BEGIN;

-- ============================================================
-- Migration: instructors_rls_hardening
-- Session 14 sub-phase 1.0 — DeepSeek adversarial QA fixes
-- ============================================================
--
-- Addresses:
--   [HIGH-1]   Privilege escalation via self-UPDATE on instructors
--              Defense in depth: column-level UPDATE restricted to safe allowlist
--              + RLS UPDATE policy added (already enabled, t).
--              RLS DECISION: kunacademy (app role) has rolbypassrls=f, rolsuper=f.
--              App writes as kunacademy which bypasses RLS only via its column-level
--              grants. authenticated/anon currently hold NO UPDATE grants at all.
--              However, we add the UPDATE RLS policy as defense-in-depth so any future
--              GRANT UPDATE to authenticated is automatically scoped to self-rows only.
--              kunacademy_admin (rolbypassrls=t) and service_role (rolbypassrls=t)
--              bypass RLS for legitimate admin operations — safe.
--
--   [MEDIUM-1] SECURITY DEFINER search_path: kun.can_perform had no explicit
--              search_path, opening a search-path injection vector.
--              Fixed by adding SET search_path = kun, public, pg_catalog to both
--              kun.can_perform and kun.icf_rank.
--
--   [MEDIUM-2] icf_rank case sensitivity: kun.icf_rank('PCC') returned 0 because
--              CASE matched exact lowercase only. Fixed with LOWER() wrapper.
--
--   [BONUS]    title_en SELECT asymmetry: previous migration granted title_en to anon
--              but not authenticated (acknowledged as intentional in that migration's
--              comments, but clearly a bug). Corrected here.
--
-- Pre-conditions verified on live VPS 2026-04-14:
--   - RLS already enabled on instructors (relrowsecurity = t)
--   - Existing policies: "Public can read visible instructors" (SELECT, is_visible=true)
--                        "Admins full access on instructors" (ALL, is_admin())
--   - authenticated/anon have NO UPDATE grants (table or column level)
--   - kunacademy has full column-level UPDATE (all 20 cols) — app role
--   - kunacademy_admin has full column-level UPDATE + rolbypassrls=t
--   - service_role has full column-level UPDATE + rolbypassrls=t
-- ============================================================

-- ── BONUS FIX: title_en SELECT asymmetry ────────────────────
-- anon had title_en; authenticated was missing it (prior migration comment
-- acknowledged this as matching "live state" but it is a defect).
GRANT SELECT (title_en) ON instructors TO authenticated;


-- ── HIGH-1: Column-level UPDATE hardening ───────────────────
-- Revoke any blanket UPDATE that might exist for authenticated/anon.
-- (Currently none exist, but safe to run — idempotent no-op if not present.)
REVOKE UPDATE ON instructors FROM authenticated, anon;

-- Grant column-level UPDATE on SAFE columns only to authenticated.
-- Excluded (sensitive): service_roles, icf_credential, kun_level,
--   is_platform_coach, is_visible, display_order, id, profile_id,
--   slug, coach_level_legacy_do_not_use
GRANT UPDATE (
  bio_ar,
  bio_en,
  title_ar,
  title_en,
  photo_url,
  coaching_styles,
  specialties,
  credentials,
  development_types,
  pricing_json
) ON instructors TO authenticated;


-- ── HIGH-1: RLS UPDATE policy (defense-in-depth) ────────────
-- RLS is already enabled. Add an UPDATE policy so authenticated users
-- can only update their own instructor row. No WITH CHECK needed beyond
-- profile_id match since column-level grants above already restrict
-- which fields can change.
-- NOTE: This system uses app_uid() (not auth.uid()) — self-hosted Postgres
--       with Auth.js. app_uid() reads from SET LOCAL app.current_user_id.
--       See migration 20260406000000_replace_auth_uid.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'instructors' AND policyname = 'instructors_update_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY instructors_update_self ON instructors
        FOR UPDATE
        TO authenticated
        USING (profile_id = app_uid())
        WITH CHECK (profile_id = app_uid())
    $policy$;
  END IF;
END;
$$;

-- ── HIGH-1: RLS SELECT policy — add self-visibility ─────────
-- Existing "Public can read visible instructors" policy uses USING (is_visible = true).
-- An instructor whose profile is hidden (is_visible=false) should still be able
-- to read their own row. Replace policy with one that covers both cases.
DROP POLICY IF EXISTS "Public can read visible instructors" ON instructors;
CREATE POLICY instructors_select_public ON instructors
  FOR SELECT
  USING (is_visible = true OR profile_id = app_uid());


-- ── MEDIUM-1 + MEDIUM-2: Rebuild kun.icf_rank ───────────────
-- Adds: LOWER() wrapper for case-insensitivity + SET search_path
CREATE OR REPLACE FUNCTION kun.icf_rank(p_icf TEXT)
RETURNS INT LANGUAGE SQL IMMUTABLE
SET search_path = kun, public, pg_catalog
AS $$
  SELECT CASE LOWER(COALESCE(p_icf, 'none'))
    WHEN 'none' THEN 0
    WHEN 'acc'  THEN 1
    WHEN 'pcc'  THEN 2
    WHEN 'mcc'  THEN 3
    ELSE 0
  END;
$$;


-- ── MEDIUM-1: Rebuild kun.can_perform ───────────────────────
-- Adds: SET search_path = kun, public, pg_catalog
-- Body is otherwise identical to prior definition (preserved verbatim).
CREATE OR REPLACE FUNCTION kun.can_perform(p_user_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = kun, public, pg_catalog
AS $$
DECLARE
  v_roles TEXT[];
  v_icf   TEXT;
BEGIN
  SELECT service_roles, icf_credential
    INTO v_roles, v_icf
  FROM instructors
  WHERE profile_id = p_user_id;

  IF v_roles IS NULL THEN RETURN FALSE; END IF;

  RETURN CASE p_action
    WHEN 'deliver_coaching'                        THEN 'coach'           = ANY(v_roles)
    WHEN 'deliver_developmental_mentoring_session' THEN 'mentor_coach'    = ANY(v_roles) AND kun.icf_rank(v_icf) >= 2
    WHEN 'deliver_final_mentoring_session'         THEN 'advanced_mentor' = ANY(v_roles) AND kun.icf_rank(v_icf) >= 2
    WHEN 'assess_recording'                        THEN 'advanced_mentor' = ANY(v_roles) AND kun.icf_rank(v_icf) >= 2
    WHEN 'record_voice_fail_message'               THEN 'advanced_mentor' = ANY(v_roles) AND kun.icf_rank(v_icf) >= 2
    WHEN 'second_opinion_assess'                   THEN 'advanced_mentor' = ANY(v_roles) AND kun.icf_rank(v_icf) >= 2
    WHEN 'curate_milestones'                       THEN 'mentor_manager'  = ANY(v_roles) AND kun.icf_rank(v_icf) >= 3
    WHEN 'resolve_escalation'                      THEN 'mentor_manager'  = ANY(v_roles) AND kun.icf_rank(v_icf) >= 3
    WHEN 'edit_rubric_template'                    THEN 'mentor_manager'  = ANY(v_roles) AND kun.icf_rank(v_icf) >= 3
    WHEN 'create_package_template'                 THEN 'mentor_manager'  = ANY(v_roles) AND kun.icf_rank(v_icf) >= 3
    WHEN 'deliver_training_course'                 THEN 'teacher'         = ANY(v_roles) AND kun.icf_rank(v_icf) >= 2
    WHEN 'facilitate_retreat'                      THEN 'teacher'         = ANY(v_roles) AND kun.icf_rank(v_icf) >= 2
    WHEN 'publish_methodology'                     THEN 'teacher'         = ANY(v_roles) AND kun.icf_rank(v_icf) >= 3
    ELSE FALSE
  END;
END;
$$;


-- ── Smoke tests ─────────────────────────────────────────────

-- Test 1: can_perform on nonexistent user must return FALSE
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT kun.can_perform('00000000-0000-0000-0000-000000000000'::uuid, 'deliver_coaching')
    INTO v_result;
  IF v_result IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'SMOKE TEST FAILED: can_perform(nonexistent) returned % instead of FALSE', v_result;
  END IF;
  RAISE NOTICE 'SMOKE TEST PASSED: can_perform(nonexistent) = FALSE';
END;
$$;

-- Test 2: icf_rank case-insensitivity — PCC must return 2 regardless of case
DO $$
DECLARE
  v_upper INT;
  v_mixed INT;
  v_lower INT;
BEGIN
  SELECT kun.icf_rank('PCC') INTO v_upper;
  SELECT kun.icf_rank('Pcc') INTO v_mixed;
  SELECT kun.icf_rank('pcc') INTO v_lower;

  IF v_upper <> 2 OR v_mixed <> 2 OR v_lower <> 2 THEN
    RAISE EXCEPTION 'SMOKE TEST FAILED: icf_rank case results = %, %, % (expected 2,2,2)',
      v_upper, v_mixed, v_lower;
  END IF;
  RAISE NOTICE 'SMOKE TEST PASSED: icf_rank(PCC)=%, icf_rank(Pcc)=%, icf_rank(pcc)=%',
    v_upper, v_mixed, v_lower;
END;
$$;

COMMIT;
