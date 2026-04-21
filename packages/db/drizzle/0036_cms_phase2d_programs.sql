-- Migration 0036: CMS→DB Phase 2d — programs
--
-- Replaces the CMS `programs` sheet (34 program rows). One DB row per program slug.
-- Landing pages will be upgraded to FK reference this table in migration 0037.
--
-- Schema deliberately matches the CMS `Program` type surface (packages/cms/src/types.ts)
-- so DbContentProvider can round-trip to Program without invention:
--   slug, title_*, subtitle_*, description_*, nav_group, type, format,
--   instructor_slug, duration, next_start_date, enrollment_deadline,
--   TheaterPricing (price_aed/egp/usd/eur), early_bird, discount, bundle_id,
--   installment_enabled, is_icf_accredited, icf_details, cce_units,
--   access_duration_days, hero_image_url, thumbnail_url, program_logo,
--   is_featured, is_free, display_order, status, category, parent_code,
--   prerequisite_codes[], pathway_codes[], curriculum_json, faq_json,
--   meta_* (SEO), og_image_url, promo_video_url, content_doc_id,
--   journey_stages, materials_folder_url, location, published.
--
-- Idempotent (IF NOT EXISTS everywhere). RLS: anon-read-published, admin-all.

-- ── programs table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     text NOT NULL UNIQUE,

  -- Bilingual identity
  title_ar                 text NOT NULL,
  title_en                 text NOT NULL,
  subtitle_ar              text,
  subtitle_en              text,
  description_ar           text,
  description_en           text,

  -- Taxonomy — mirror CMS enums (CHECK, not enum type, keeps migrations cheap)
  nav_group                text NOT NULL
                           CHECK (nav_group IN
                             ('certifications','courses','retreats','micro-courses',
                              'corporate','free','community')),
  type                     text NOT NULL
                           CHECK (type IN
                             ('certification','diploma','recorded-course','live-course',
                              'retreat','micro-course','workshop','free-resource')),
  format                   text NOT NULL DEFAULT 'online'
                           CHECK (format IN ('online','in-person','hybrid')),
  status                   text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','coming-soon','archived','paused')),
  category                 text,  -- free-text filter tag (certification|specialization|...)
  parent_code              text,  -- e.g. STCE for all STCE levels

  -- People + place
  instructor_slug          text,  -- references instructors.slug (loose link — CMS pattern)
  location                 text,  -- for in-person/hybrid programs

  -- Timing
  duration                 text,  -- free-text "40 hours", "3 days"
  next_start_date          date,
  enrollment_deadline      date,
  access_duration_days     integer,

  -- Pricing (TheaterPricing parity)
  price_aed                numeric(10, 2),
  price_egp                numeric(10, 2),
  price_usd                numeric(10, 2),
  price_eur                numeric(10, 2),
  early_bird_price_aed     numeric(10, 2),
  early_bird_deadline      date,
  discount_percentage      numeric(5, 2),
  discount_valid_until     date,
  installment_enabled      boolean NOT NULL DEFAULT false,
  bundle_id                text,

  -- ICF / CCE
  is_icf_accredited        boolean NOT NULL DEFAULT false,
  icf_details              text,
  cce_units                numeric(6, 2),

  -- Visual
  hero_image_url           text,
  thumbnail_url            text,
  program_logo             text,
  promo_video_url          text,

  -- Pathways / prereqs (text arrays — CMS allowed CSV-joined strings)
  prerequisite_codes       text[] NOT NULL DEFAULT '{}',
  pathway_codes            text[] NOT NULL DEFAULT '{}',

  -- Rich blobs (stored as-provided; rendered client-side)
  curriculum_json          jsonb,                    -- array of modules
  faq_json                 jsonb,                    -- array of Q&A pairs
  journey_stages           text,                     -- free-text journey narrative
  materials_folder_url     text,                     -- Drive/WorkDrive URL
  content_doc_id           text,                     -- Google Doc ID for rich body

  -- SEO
  meta_title_ar            text,
  meta_title_en            text,
  meta_description_ar      text,
  meta_description_en      text,
  og_image_url             text,

  -- Flags
  is_featured              boolean NOT NULL DEFAULT false,
  is_free                  boolean NOT NULL DEFAULT false,

  -- Ordering + lifecycle
  display_order            integer NOT NULL DEFAULT 0,
  published                boolean NOT NULL DEFAULT true,
  published_at             timestamptz,

  last_edited_by           uuid REFERENCES profiles(id),
  last_edited_at           timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS programs_slug_uidx         ON programs (slug);
CREATE INDEX        IF NOT EXISTS programs_nav_group_idx     ON programs (nav_group);
CREATE INDEX        IF NOT EXISTS programs_type_idx          ON programs (type);
CREATE INDEX        IF NOT EXISTS programs_category_idx      ON programs (category) WHERE category IS NOT NULL;
CREATE INDEX        IF NOT EXISTS programs_published_idx     ON programs (published);
CREATE INDEX        IF NOT EXISTS programs_display_order_idx ON programs (display_order);
CREATE INDEX        IF NOT EXISTS programs_is_featured_idx   ON programs (is_featured) WHERE is_featured = true;

-- ── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION programs_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS programs_touch_updated_at ON programs;
CREATE TRIGGER programs_touch_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION programs_touch_updated_at();

-- ── GRANTs ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON programs TO kunacademy, kunacademy_admin;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS programs_published_read ON programs;
CREATE POLICY programs_published_read
  ON programs FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS programs_admin_all ON programs;
CREATE POLICY programs_admin_all
  ON programs FOR ALL
  USING (is_admin());
