-- ============================================================================
-- Migration: 20260418122341_phase_2_0_rubric_templates
-- Sub-phase: S2-Layer-1 / 2.0
-- Creates: rubric_templates
-- RLS:
--   admin (kunacademy_admin): read + write all
--   advanced_mentor / mentor_manager: read published rows only
--   everyone else: no access
-- Source: SPEC-somatic-thinking-rubric-v1.md §4.1
-- Architecture:
--   app_uid()  → current_setting('app.current_user_id', true)::uuid
--   is_admin() → profiles.role IN ('admin','super_admin')
--   has_assessor_role() → instructors.service_roles @> ARRAY['advanced_mentor']
--                         OR instructors.service_roles @> ARRAY['mentor_manager']
--   DB roles: kunacademy (app, no bypass), kunacademy_admin (bypass RLS),
--             authenticated (RLS target), anon
-- Immutability: BEFORE UPDATE trigger blocks structural edits once published = true
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: rubric_templates
-- Source: SPEC §4.1
-- One row per (id, version) — composite PK supports future rubric edits.
-- Structural columns are immutable once published = true (trigger below).
-- ============================================================================

CREATE TABLE IF NOT EXISTS rubric_templates (
  id          TEXT        NOT NULL,
                          -- e.g. 'somatic_thinking_level_1'
  version     INT         NOT NULL,
                          -- incremented when structure changes; never mutate published rows
  published   BOOLEAN     NOT NULL DEFAULT false,

  title_ar    TEXT        NOT NULL,
  title_en    TEXT        NOT NULL,
  description_ar TEXT,
  description_en TEXT,

  -- Full rubric definition: parts, items, labels, ethics gates, summary fields
  structure   JSONB       NOT NULL,

  created_by  UUID        REFERENCES instructors(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (id, version)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup of published rubrics by id (for runtime assessor workspace)
CREATE INDEX IF NOT EXISTS idx_rubric_templates_id_published
  ON rubric_templates (id, published)
  WHERE published = true;

-- ============================================================================
-- IMMUTABILITY TRIGGER
-- Blocks structural edits once a rubric is published.
-- Per SPEC §4.1: "rubric edits never mutate an existing published row.
--                A new version gets written; the old version stays forever."
-- ============================================================================

CREATE OR REPLACE FUNCTION rubric_templates_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow non-structural updates on published rows (e.g. updated_at touch)
  -- Block only if a structural column is being changed
  IF OLD.published = true THEN
    IF (
      OLD.structure     IS DISTINCT FROM NEW.structure     OR
      OLD.title_ar      IS DISTINCT FROM NEW.title_ar      OR
      OLD.title_en      IS DISTINCT FROM NEW.title_en      OR
      OLD.description_ar IS DISTINCT FROM NEW.description_ar OR
      OLD.description_en IS DISTINCT FROM NEW.description_en
    ) THEN
      RAISE EXCEPTION
        'rubric_templates immutability violation: '
        'cannot mutate structural columns on published rubric (id=%, version=%)',
        OLD.id, OLD.version
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_rubric_templates_immutability
  BEFORE UPDATE ON rubric_templates
  FOR EACH ROW
  EXECUTE FUNCTION rubric_templates_immutability_guard();

-- ============================================================================
-- RLS: rubric_templates
-- Admin (kunacademy_admin): bypasses RLS via BYPASSRLS
-- Assessors (advanced_mentor / mentor_manager): SELECT published rows only
-- Everyone else: no access
-- ============================================================================

ALTER TABLE rubric_templates ENABLE ROW LEVEL SECURITY;

-- Helper: checks if the current app user holds an assessor service role
-- Uses app_uid() → instructors table → service_roles[]
CREATE OR REPLACE FUNCTION is_assessor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM instructors i
    JOIN profiles p ON p.id = i.profile_id
    WHERE p.id = app_uid()
      AND (
        i.service_roles @> ARRAY['advanced_mentor']::text[]
        OR i.service_roles @> ARRAY['mentor_manager']::text[]
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Assessors: read-only access to published rubrics
CREATE POLICY rt_select_assessor ON rubric_templates
  FOR SELECT
  USING (
    published = true
    AND is_assessor()
  );

-- Admin: full access (managed via kunacademy_admin BYPASSRLS + explicit policy)
CREATE POLICY rt_admin_all ON rubric_templates
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- COLUMN-LEVEL GRANTS
-- authenticated role can read (filtered by RLS above)
-- Only admin role (kunacademy_admin) can write — enforced via RLS + BYPASSRLS
-- ============================================================================

GRANT SELECT ON rubric_templates TO authenticated;

-- ============================================================================
-- SMOKE TESTS
-- ============================================================================

DO $$
BEGIN
  -- Test 1: table exists
  PERFORM 1 FROM information_schema.tables
    WHERE table_name = 'rubric_templates' AND table_schema = 'public';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMOKE FAIL: rubric_templates table not created';
  END IF;
  RAISE NOTICE 'SMOKE 1 PASSED: rubric_templates table exists';

  -- Test 2: RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'rubric_templates'
      AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: RLS not enabled on rubric_templates';
  END IF;
  RAISE NOTICE 'SMOKE 2 PASSED: RLS enabled on rubric_templates';

  -- Test 3: immutability trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_rubric_templates_immutability'
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: immutability trigger not created';
  END IF;
  RAISE NOTICE 'SMOKE 3 PASSED: immutability trigger exists';
END $$;

DO $$
DECLARE
  v_inserted BOOLEAN;
BEGIN
  -- Test 4: trigger blocks structural mutation of a published row
  -- Insert a test rubric (unpublished first)
  INSERT INTO rubric_templates (id, version, published, title_ar, title_en, structure)
  VALUES (
    '__smoke_test__', 1, false,
    'اختبار', 'Smoke Test',
    '{"parts": []}'::jsonb
  );

  -- Publish it
  UPDATE rubric_templates
    SET published = true
  WHERE id = '__smoke_test__' AND version = 1;

  -- Attempt structural mutation — must raise exception
  BEGIN
    UPDATE rubric_templates
      SET title_en = 'MUTATED'
    WHERE id = '__smoke_test__' AND version = 1;
    RAISE EXCEPTION 'SMOKE FAIL: immutability trigger did not block mutation of published rubric';
  EXCEPTION
    WHEN integrity_constraint_violation THEN
      RAISE NOTICE 'SMOKE 4 PASSED: immutability trigger correctly blocked structural mutation';
  END;

  -- Clean up smoke test row
  DELETE FROM rubric_templates WHERE id = '__smoke_test__';
END $$;

-- ============================================================================
-- MIGRATION TRACKING
-- tag: 20260418122341_phase_2_0_rubric_templates
-- when: 1776429761000  (ms-since-epoch for 2026-04-18 12:23:41 UTC)
-- ============================================================================

COMMIT;
