-- Migration 0056: Wave E.2 — scholarship schema caveats patch
--
-- Context:
--   Retroactive DeepSeek adversarial QA on E.1 (migration 0054) flagged 2
--   real MEDIUM-severity gaps that were deferred to E.2:
--     (a) scholarship_applications.updated_at lacks an auto-update trigger
--         (codebase pattern: *_touch_updated_at() — used in 0036, 0038, 0042, 0055).
--     (b) donations.ts Drizzle schema file missing expression + partial index
--         definitions for idx_donations_email and idx_donations_subscription,
--         and missing idx_donations_designation entirely. Those are fixed in
--         the schema.ts file itself (see packages/db/src/schema/donations.ts).
--         This migration doesn't touch the DB — the indexes are already
--         correct on-disk from 0054.
--
-- Scope:
--   - Add scholarship_applications_touch_updated_at() function + BEFORE UPDATE
--     trigger. Matches the pattern in 0055, 0036, 0038.
--   - Idempotent via DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION.
--
-- Rollback: drop the trigger + function.

BEGIN;

CREATE OR REPLACE FUNCTION scholarship_applications_touch_updated_at()
RETURNS trigger AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scholarship_applications_touch_updated_at ON scholarship_applications;

CREATE TRIGGER scholarship_applications_touch_updated_at
  BEFORE UPDATE ON scholarship_applications
  FOR EACH ROW
  EXECUTE FUNCTION scholarship_applications_touch_updated_at();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, not auto-executed)
-- ═══════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   DROP TRIGGER IF EXISTS scholarship_applications_touch_updated_at ON scholarship_applications;
--   DROP FUNCTION IF EXISTS scholarship_applications_touch_updated_at();
-- COMMIT;
