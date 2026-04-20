-- Migration 0030: add legacy_slug to testimonials for CMS→DB Phase 1b
--
-- CMS testimonials use slug-like string IDs (e.g. "nizar", "scott-mcconnell").
-- DB testimonials.id is UUID with gen_random_uuid() default.
-- This column preserves the CMS identifier so:
--   - Re-running the Phase 1b migration script is idempotent (keyed on legacy_slug)
--   - External references / links to /testimonials/<slug> continue to work
--   - Admin can see the original slug in the audit log

ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS legacy_slug TEXT;

-- Unique when set (nullable — admin-created testimonials won't have one)
CREATE UNIQUE INDEX IF NOT EXISTS testimonials_legacy_slug_key
  ON testimonials (legacy_slug)
  WHERE legacy_slug IS NOT NULL;
