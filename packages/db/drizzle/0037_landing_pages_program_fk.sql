-- Migration 0037: Upgrade landing_pages.program_slug → real FK via program_id.
--
-- Phase 2d follow-up. Keeps the TEXT `program_slug` column for backwards compat
-- (consumers that read it directly still work). Adds a nullable `program_id`
-- FK to programs(id) with ON DELETE SET NULL, and backfills from matching slug.
--
-- Verification of gaps is done in scripts/migrate-programs.ts (EMIT_SQL report).
-- We do NOT drop the TEXT column until the gap count is 0.
--
-- Idempotent. Safe to re-run.

-- Add column if missing (note: programs table must exist from 0036 first)
ALTER TABLE landing_pages
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES programs(id) ON DELETE SET NULL;

-- Index for lookups (landing pages by program)
CREATE INDEX IF NOT EXISTS landing_pages_program_id_idx
  ON landing_pages (program_id) WHERE program_id IS NOT NULL;

-- Backfill from matching slug — only for rows where program_id is null and a slug exists.
-- Safe to run multiple times; empty-set match on re-run.
UPDATE landing_pages lp
SET program_id = p.id
FROM programs p
WHERE lp.program_id IS NULL
  AND lp.program_slug IS NOT NULL
  AND lp.program_slug = p.slug;

-- Report (cosmetic — output appears in psql -f run):
DO $$
DECLARE
  matched_count  int;
  unmatched_rows text;
BEGIN
  SELECT count(*) INTO matched_count
    FROM landing_pages WHERE program_id IS NOT NULL;

  SELECT string_agg(DISTINCT program_slug, ', ')
    INTO unmatched_rows
    FROM landing_pages lp
   WHERE lp.program_slug IS NOT NULL
     AND lp.program_id IS NULL;

  RAISE NOTICE 'landing_pages.program_id backfill: matched=%', matched_count;
  IF unmatched_rows IS NOT NULL THEN
    RAISE NOTICE 'landing_pages unmatched program slugs: %', unmatched_rows;
  END IF;
END $$;
