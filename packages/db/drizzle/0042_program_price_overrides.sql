-- Migration 0042: Region-level price overrides for service-type programs
--
-- Creates the `program_price_overrides` table which stores per-region
-- price entries for programs (initially: wisal, seeds-parents, seeds-caregivers).
--
-- Design:
--   - program_slug FK → programs.slug (ON DELETE CASCADE: removes overrides
--     when the program is deleted from the DB)
--   - UNIQUE(program_slug, region): exactly one price per program per region
--   - RLS: anon + authenticated can SELECT; writes require kunacademy_admin role
--     (i.e. must go through withAdminContext)
--   - No SUPERUSER granted at any point.
--
-- Idempotent: uses IF NOT EXISTS guards throughout.

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_price_overrides (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_slug  text        NOT NULL
                              REFERENCES programs(slug) ON DELETE CASCADE,
  region        text        NOT NULL
                              CHECK (char_length(region) BETWEEN 2 AND 16),
  price         numeric(10,2) NOT NULL
                              CHECK (price >= 0),
  currency      text        NOT NULL
                              CHECK (currency IN ('AED','EGP','SAR','USD','EUR')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_price_overrides_slug_region_uq UNIQUE (program_slug, region)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ppo_program_slug_idx
  ON program_price_overrides (program_slug);

CREATE INDEX IF NOT EXISTS ppo_region_idx
  ON program_price_overrides (region);

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- Re-use the set_updated_at() function that already exists in the DB
-- (created by an earlier migration for programs / events / landing_pages).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_program_price_overrides_updated_at'
  ) THEN
    CREATE TRIGGER set_program_price_overrides_updated_at
      BEFORE UPDATE ON program_price_overrides
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ── Row-level security ───────────────────────────────────────────────────────
ALTER TABLE program_price_overrides ENABLE ROW LEVEL SECURITY;

-- Public read: any visitor (including unauthenticated) may read overrides
-- so the public price-display path can use them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'program_price_overrides'
      AND policyname = 'ppo_anon_public_read'
  ) THEN
    CREATE POLICY ppo_anon_public_read
      ON program_price_overrides
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Admin write: INSERT / UPDATE / DELETE restricted to kunacademy_admin role
-- (which withAdminContext uses via SET LOCAL role).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'program_price_overrides'
      AND policyname = 'ppo_admin_write'
  ) THEN
    CREATE POLICY ppo_admin_write
      ON program_price_overrides
      FOR ALL
      TO kunacademy_admin
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── GRANTs ───────────────────────────────────────────────────────────────────
-- kunacademy (app role): SELECT only — reads go through the anon RLS policy
-- in public-facing paths. Write paths go through kunacademy_admin.
GRANT SELECT ON program_price_overrides TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON program_price_overrides TO kunacademy_admin;
