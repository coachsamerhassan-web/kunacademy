-- Migration 0044: CMS→DB Phase 3d — corporate_benefit_directions + corporate_benefits
--
-- Migrates apps/web/data/cms/corporate-benefits.json (4 directions × 10/10/10/3
-- benefits = 33 benefit rows + 4 direction rows) into two related tables.
--
-- Design:
--   corporate_benefit_directions  — 4 rows, bilingual title/description, icon,
--     benefits_mode enum ('list' | 'all'). The `custom_program` direction uses
--     benefits_mode='all' to indicate "flatten all benefits from every other
--     direction" (replaces the JSON sentinel  "benefits": "all").
--   corporate_benefits            — 33 rows, FK to direction_slug, bilingual
--     label/description/citation/self_assessment_prompt, benchmark_improvement_pct
--     (int), roi_category enum ('productivity' | 'turnover' | 'absenteeism' |
--     'engagement' | 'conflict').
--
-- RLS:
--   anon SELECT published rows
--   admin ALL
--
-- Grants:
--   anon                 SELECT
--   authenticated        SELECT
--   kunacademy (app)     SELECT, INSERT, UPDATE, DELETE
--   kunacademy_admin     SELECT, INSERT, UPDATE, DELETE
--
-- Indexes:
--   corporate_benefit_directions (display_order)
--   corporate_benefits (direction_slug, display_order)
--   corporate_benefits (roi_category)
--
-- Data source: apps/web/data/cms/corporate-benefits.json (v1.0)
-- Row-count targets:
--   corporate_benefit_directions = 4
--   corporate_benefits           = 33

BEGIN;

-- ── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE corporate_benefits_mode AS ENUM ('list', 'all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE corporate_roi_category AS ENUM (
    'productivity', 'turnover', 'absenteeism', 'engagement', 'conflict'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── corporate_benefit_directions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS corporate_benefit_directions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  title_ar          TEXT NOT NULL,
  title_en          TEXT NOT NULL,
  description_ar    TEXT,
  description_en    TEXT,
  icon              TEXT,
  benefits_mode     corporate_benefits_mode NOT NULL DEFAULT 'list',
  display_order     INTEGER NOT NULL DEFAULT 0,
  published         BOOLEAN NOT NULL DEFAULT true,
  last_edited_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_edited_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS corporate_benefit_directions_display_order_idx
  ON corporate_benefit_directions (display_order);

ALTER TABLE corporate_benefit_directions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS corporate_benefit_directions_public_select ON corporate_benefit_directions;
CREATE POLICY corporate_benefit_directions_public_select ON corporate_benefit_directions
  FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS corporate_benefit_directions_admin ON corporate_benefit_directions;
CREATE POLICY corporate_benefit_directions_admin ON corporate_benefit_directions
  FOR ALL
  USING (is_admin());

GRANT SELECT                         ON corporate_benefit_directions TO anon;
GRANT SELECT                         ON corporate_benefit_directions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON corporate_benefit_directions TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON corporate_benefit_directions TO kunacademy_admin;

-- ── corporate_benefits ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS corporate_benefits (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                         TEXT NOT NULL UNIQUE,
  direction_slug               TEXT NOT NULL
                               REFERENCES corporate_benefit_directions(slug)
                               ON UPDATE CASCADE
                               ON DELETE RESTRICT,
  label_ar                     TEXT NOT NULL,
  label_en                     TEXT NOT NULL,
  description_ar               TEXT,
  description_en               TEXT,
  citation_ar                  TEXT,
  citation_en                  TEXT,
  benchmark_improvement_pct    INTEGER NOT NULL DEFAULT 0,
  roi_category                 corporate_roi_category NOT NULL DEFAULT 'productivity',
  self_assessment_prompt_ar    TEXT,
  self_assessment_prompt_en    TEXT,
  display_order                INTEGER NOT NULL DEFAULT 0,
  published                    BOOLEAN NOT NULL DEFAULT true,
  last_edited_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_edited_at               TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS corporate_benefits_direction_slug_idx
  ON corporate_benefits (direction_slug, display_order);
CREATE INDEX IF NOT EXISTS corporate_benefits_roi_category_idx
  ON corporate_benefits (roi_category);
CREATE INDEX IF NOT EXISTS corporate_benefits_published_idx
  ON corporate_benefits (published) WHERE published = true;

ALTER TABLE corporate_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS corporate_benefits_public_select ON corporate_benefits;
CREATE POLICY corporate_benefits_public_select ON corporate_benefits
  FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS corporate_benefits_admin ON corporate_benefits;
CREATE POLICY corporate_benefits_admin ON corporate_benefits
  FOR ALL
  USING (is_admin());

GRANT SELECT                         ON corporate_benefits TO anon;
GRANT SELECT                         ON corporate_benefits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON corporate_benefits TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON corporate_benefits TO kunacademy_admin;

-- ── Verification ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_dir_cols int;
  v_ben_cols int;
BEGIN
  SELECT count(*) INTO v_dir_cols
    FROM information_schema.columns
   WHERE table_name = 'corporate_benefit_directions'
     AND column_name IN (
       'slug','title_ar','title_en','description_ar','description_en',
       'icon','benefits_mode','display_order','published',
       'last_edited_by','last_edited_at','created_at','updated_at'
     );
  IF v_dir_cols < 13 THEN
    RAISE EXCEPTION 'corporate_benefit_directions schema failed: expected >=13 cols, got %', v_dir_cols;
  END IF;

  SELECT count(*) INTO v_ben_cols
    FROM information_schema.columns
   WHERE table_name = 'corporate_benefits'
     AND column_name IN (
       'slug','direction_slug','label_ar','label_en','description_ar','description_en',
       'citation_ar','citation_en','benchmark_improvement_pct','roi_category',
       'self_assessment_prompt_ar','self_assessment_prompt_en',
       'display_order','published','last_edited_by','last_edited_at',
       'created_at','updated_at'
     );
  IF v_ben_cols < 18 THEN
    RAISE EXCEPTION 'corporate_benefits schema failed: expected >=18 cols, got %', v_ben_cols;
  END IF;

  RAISE NOTICE 'CMS Phase 3d schema created: % direction cols, % benefit cols', v_dir_cols, v_ben_cols;
END $$;

COMMIT;
