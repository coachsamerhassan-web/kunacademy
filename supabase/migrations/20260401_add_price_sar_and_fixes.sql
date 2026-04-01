-- Add SAR pricing column to courses (missing from original schema)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_sar INTEGER DEFAULT 0;

-- Add SAR pricing to services table too
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_sar INTEGER DEFAULT 0;

-- Backfill SAR from AED (approximate 1:1 for Gulf market)
UPDATE courses SET price_sar = price_aed WHERE price_sar = 0 AND price_aed > 0;
UPDATE services SET price_sar = price_aed WHERE price_sar = 0 AND price_aed > 0;

-- Add unique partial index on instructors.profile_id for join integrity
CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_profile_id_unique
  ON instructors(profile_id) WHERE profile_id IS NOT NULL;
