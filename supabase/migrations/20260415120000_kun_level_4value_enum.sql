BEGIN;

-- Rewrite existing instructor rows to the spec-authoritative enum
UPDATE instructors
SET kun_level = CASE kun_level
  WHEN 'novice'     THEN 'basic'
  WHEN 'proficient' THEN 'professional'
  WHEN 'expert'     THEN 'expert'
  ELSE kun_level
END
WHERE kun_level IN ('novice','proficient');

-- Add (or replace) the CHECK constraint so old values can never re-enter
ALTER TABLE instructors DROP CONSTRAINT IF EXISTS instructors_kun_level_check;
ALTER TABLE instructors ADD CONSTRAINT instructors_kun_level_check
  CHECK (kun_level IS NULL OR kun_level IN ('basic','professional','expert','master'));

-- Smoke test inside the transaction
DO $$
DECLARE v INT;
BEGIN
  SELECT COUNT(*) INTO v FROM instructors WHERE kun_level IN ('novice','proficient');
  IF v <> 0 THEN RAISE EXCEPTION 'rewrite failed: % legacy values remain', v; END IF;
  RAISE NOTICE 'SMOKE TEST PASSED: zero legacy kun_level values remain';
END $$;

COMMIT;
