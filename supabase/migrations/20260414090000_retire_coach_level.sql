BEGIN;

-- 1. Guarded truncate of the junk row (max 1 row, known bad mapping)
DELETE FROM instructors
WHERE (SELECT COUNT(*) FROM instructors) = 1
  AND coach_level = 'professional'
  AND kun_level = 'expert'
  AND service_roles IS NULL;

-- 2. Rename legacy column (soft-deprecate; reversible)
ALTER TABLE instructors RENAME COLUMN coach_level TO coach_level_legacy_do_not_use;

-- 3. Revoke SELECT on the renamed column from authenticated + anon
REVOKE SELECT (coach_level_legacy_do_not_use) ON instructors FROM authenticated, anon;

-- 4. Expand service_roles CHECK to include 'teacher' (drop+recreate)
ALTER TABLE instructors DROP CONSTRAINT IF EXISTS instructors_service_roles_check;
ALTER TABLE instructors ADD CONSTRAINT instructors_service_roles_check
  CHECK (service_roles <@ ARRAY['coach','mentor_coach','advanced_mentor','mentor_manager','teacher']::text[]);

-- 5. kun schema + icf_rank helper + can_perform function
CREATE SCHEMA IF NOT EXISTS kun;

CREATE OR REPLACE FUNCTION kun.icf_rank(p_icf TEXT)
RETURNS INT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE COALESCE(p_icf, 'none')
    WHEN 'none' THEN 0
    WHEN 'acc'  THEN 1
    WHEN 'pcc'  THEN 2
    WHEN 'mcc'  THEN 3
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION kun.can_perform(p_user_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
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

COMMIT;
