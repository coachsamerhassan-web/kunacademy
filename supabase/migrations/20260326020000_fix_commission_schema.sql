-- Fix Commission & Payout System Schema (2026-03-26)
-- Issues: Mismatch between DB schema and API implementation
-- Changes: Add missing fields and align naming conventions

-- ============================================================================
-- 1. Fix COMMISSION_RATES - align naming with API usage
-- ============================================================================

-- Add 'scope' as alias for consistency, or rename column
-- Current API uses 'scope' but expects to query by 'scope_id' with coach_id
-- Migration: ensure scope='coach' is properly stored

-- Already correct in schema, no changes needed

-- ============================================================================
-- 2. Fix EARNINGS - align field names with API
-- ============================================================================

-- The API uses 'coach_id' but DB has 'user_id'
-- Solution: Keep user_id (it's semantically correct), fix API routes instead
-- Migration: Add 'available_at' field that API expects

ALTER TABLE earnings
ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ DEFAULT (now() + interval '7 days');

-- ============================================================================
-- 3. Fix PAYOUT_REQUESTS - add missing bank details field
-- ============================================================================

-- API expects bank_details JSON but DB only has payment_method TEXT and notes
-- Solution: Add bank_details JSONB column

ALTER TABLE payout_requests
ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT NULL;

-- Add admin_note as alias for notes (or migrate data)
ALTER TABLE payout_requests
ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT NULL;

-- Update existing notes to admin_note if not already populated
UPDATE payout_requests
SET admin_note = notes
WHERE admin_note IS NULL AND notes IS NOT NULL;

-- ============================================================================
-- 4. Fix Status Values - align with API expectations
-- ============================================================================

-- Current DB: 'requested','approved','processed','rejected'
-- API expects: 'requested','approved','processing','completed'
-- Need to handle existing data migration

-- For now, keep DB as-is and update API to use correct status values
-- API will use: 'approved' -> means approved for processing
--               'processing' -> not in DB, skip or use 'processed'
--               'completed' -> use 'processed' instead

-- ============================================================================
-- 5. COMMISSION_RATES - verify scope usage
-- ============================================================================

-- API code expects:
-- - scope = 'global' for global rates
-- - scope = 'coach' for coach-specific overrides
-- Current enum allows: 'global','level','profile','item'
-- Need to change 'profile' to 'coach' for clarity

-- ALTER TABLE commission_rates
-- DROP CONSTRAINT IF EXISTS "commission_rates_scope_check";
-- ALTER TABLE commission_rates
-- ADD CONSTRAINT "commission_rates_scope_check" CHECK (scope IN ('global','coach','product','service'));

-- For now, update existing 'profile' entries to 'coach':
UPDATE commission_rates
SET scope = 'coach'
WHERE scope = 'profile';

-- ============================================================================
-- 6. Add helpful comment columns for clarity
-- ============================================================================

COMMENT ON COLUMN earnings.user_id IS 'Coach/provider who earned the commission';
COMMENT ON COLUMN earnings.available_at IS 'Date when earning becomes available for payout (typically 7 days after creation)';
COMMENT ON COLUMN payout_requests.bank_details IS 'JSON: {bank_name, iban, account_name}';
COMMENT ON COLUMN payout_requests.admin_note IS 'Admin notes on the payout request';
COMMENT ON TABLE commission_rates IS 'Commission rates: scope can be global (all coaches), coach (specific coach), product (specific item), service (specific service)';
