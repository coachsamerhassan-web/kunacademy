-- Migration 0029: CMS→DB Phase 1a — foundations for SiteSetting, Quote, Testimonial extension

-- ── site_settings ────────────────────────────────────────────────
-- Replaces CMS SiteSetting (category/key/value triples, e.g. social URLs, footer tagline)
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,           -- e.g. "social", "contact", "footer", "branding", "seo"
  key text NOT NULL,                -- e.g. "instagram_url", "phone_primary"
  value text NOT NULL,              -- stringified value (JSON-encoded if structured)
  description text,                 -- optional admin-facing hint
  published boolean NOT NULL DEFAULT true,
  last_edited_by uuid REFERENCES profiles(id),
  last_edited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_settings_category_key_key ON site_settings (category, key);
CREATE INDEX IF NOT EXISTS site_settings_published_idx ON site_settings (published);

-- ── quotes ──────────────────────────────────────────────────────
-- Replaces CMS Quote (author + bilingual content + display_order)
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text NOT NULL UNIQUE,    -- human-readable stable id (e.g. "samer-2023-01")
  author_ar text NOT NULL,
  author_en text NOT NULL,
  content_ar text NOT NULL,
  content_en text NOT NULL,
  category text,                    -- e.g. "coaching", "somatic-thinking", "faith"
  display_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  quote_date date,                  -- when the quote was spoken/written
  last_edited_by uuid REFERENCES profiles(id),
  last_edited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quotes_published_display_order_idx ON quotes (published, display_order);
CREATE INDEX IF NOT EXISTS quotes_category_idx ON quotes (category) WHERE category IS NOT NULL;

-- ── testimonials extension ──────────────────────────────────────
-- Add missing columns to existing testimonials table (CMS PARTIAL → full coverage)
ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS role_ar text,
  ADD COLUMN IF NOT EXISTS role_en text,
  ADD COLUMN IF NOT EXISTS location_ar text,
  ADD COLUMN IF NOT EXISTS location_en text,
  ADD COLUMN IF NOT EXISTS country_code text,     -- ISO-3166 2-letter, e.g. "EG", "SA"
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Sanity CHECK: country_code is 2-letter uppercase (A-Z) when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'testimonials_country_code_format'
  ) THEN
    ALTER TABLE testimonials ADD CONSTRAINT testimonials_country_code_format
      CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
  END IF;
END $$;

-- ── GRANTs ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON site_settings TO kunacademy, kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON quotes         TO kunacademy, kunacademy_admin;

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes        ENABLE ROW LEVEL SECURITY;

-- site_settings: public can read published; admins full
DROP POLICY IF EXISTS site_settings_published_read ON site_settings;
CREATE POLICY site_settings_published_read ON site_settings FOR SELECT USING (published = true);
DROP POLICY IF EXISTS site_settings_admin_all ON site_settings;
CREATE POLICY site_settings_admin_all ON site_settings FOR ALL USING (is_admin());

-- quotes: public read published; admins full
DROP POLICY IF EXISTS quotes_published_read ON quotes;
CREATE POLICY quotes_published_read ON quotes FOR SELECT USING (published = true);
DROP POLICY IF EXISTS quotes_admin_all ON quotes;
CREATE POLICY quotes_admin_all ON quotes FOR ALL USING (is_admin());
