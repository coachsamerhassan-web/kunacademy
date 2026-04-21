-- Migration 0035: CMS→DB Phase 2c — landing_pages
--
-- Replaces the CMS PageContent sheet + the implicit "landing pages" surface.
-- The CMS stored 562 (slug, section, key, value_ar, value_en) rows across 28 slugs.
-- This migration consolidates that into one row per slug with JSONB sections —
-- mirroring the in-memory shape returned by ContentProvider.getPageContent():
--
--   sections_json = { [sectionKey: string]: { [key: string]: { ar, en } } }
--
-- Adjacent JSONB columns carry the per-page metadata and landing-specific hero/CTA
-- fields that PageContent used to inline on every row:
--
--   seo_meta_json = { meta_title_ar/en, meta_description_ar/en, og_image_url, canonical_url }
--   hero_json     = { hero_image_url, cta_text_ar/en, cta_url, form_embed }  — landing-only
--
-- Spec fields from task:
--   id, slug, program_id (→ kept as program_slug TEXT until Phase 2d creates programs table),
--   locale — NOT a column: sections_json is bilingual-per-key { ar, en } matching PageSections
--            shape in packages/cms/src/types.ts. A locale column would force 2 rows per page.
--   title — surfaced as generated/derived via seo_meta_json.meta_title_*.
--
-- Idempotent (IF NOT EXISTS everywhere). RLS: anon-read published, admin-all.

-- ── landing_pages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS landing_pages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text NOT NULL UNIQUE,
  -- 'page' (static site page) | 'landing' (campaign landing) | 'legal' (legal/policy)
  page_type      text NOT NULL DEFAULT 'page'
                 CHECK (page_type IN ('page','landing','legal')),
  -- Optional program link. Not a FK until Phase 2d creates the programs table.
  program_slug   text,
  -- Full page section content: { [section]: { [key]: { ar, en } } }
  sections_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Landing/hero/CTA fields (nullable — non-landing pages leave empty)
  hero_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- SEO metadata (meta_title_*, meta_description_*, og_image_url, canonical_url)
  seo_meta_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  published      boolean NOT NULL DEFAULT true,
  published_at   timestamptz,
  last_edited_by uuid REFERENCES profiles(id),
  last_edited_at timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS landing_pages_slug_idx         ON landing_pages (slug);
CREATE INDEX IF NOT EXISTS landing_pages_program_slug_idx ON landing_pages (program_slug) WHERE program_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS landing_pages_published_idx    ON landing_pages (published);
CREATE INDEX IF NOT EXISTS landing_pages_page_type_idx    ON landing_pages (page_type);

-- Maintain updated_at automatically
CREATE OR REPLACE FUNCTION landing_pages_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS landing_pages_touch_updated_at ON landing_pages;
CREATE TRIGGER landing_pages_touch_updated_at
  BEFORE UPDATE ON landing_pages
  FOR EACH ROW EXECUTE FUNCTION landing_pages_touch_updated_at();

-- ── GRANTs ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON landing_pages TO kunacademy, kunacademy_admin;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS landing_pages_published_read ON landing_pages;
CREATE POLICY landing_pages_published_read
  ON landing_pages FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS landing_pages_admin_all ON landing_pages;
CREATE POLICY landing_pages_admin_all
  ON landing_pages FOR ALL
  USING (is_admin());
