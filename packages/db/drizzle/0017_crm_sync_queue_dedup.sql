-- ============================================================================
-- Migration: 0017_crm_sync_queue_dedup
-- Purpose: (a) Dedup constraint on crm_sync_queue so racing crons cannot
--              enqueue duplicate (profile_id, operation) pairs.
--          (b) Payment-deal dedup tracking table so settlement retries do
--              not create duplicate CRM Deals for the same payment.
-- ============================================================================

BEGIN;

-- ── (a) UNIQUE constraint on crm_sync_queue ──────────────────────────────────
--
-- We want exactly one pending row per (profile_id, operation).
-- Rationale: upsert_contact and update_status are naturally singular per
-- profile; create_deal is keyed per payment_id, which is carried in the
-- payload JSONB. For create_deal we therefore include a text column
-- extracted from the payload so two deals for different payments are not
-- collapsed.
--
-- Implementation: add a nullable text column `dedup_key` and index on
-- (profile_id, operation, dedup_key) with NULLS NOT DISTINCT so that two
-- rows where dedup_key IS NULL (upsert_contact / update_status) do collapse.
--
-- Caller convention:
--   upsert_contact / update_status → dedup_key = NULL (dedups per-profile per-op)
--   create_deal                    → dedup_key = payment_id (dedups per payment)

ALTER TABLE crm_sync_queue
  ADD COLUMN IF NOT EXISTS dedup_key TEXT;

-- Back-fill existing create_deal rows from payload
UPDATE crm_sync_queue
  SET dedup_key = payload->>'payment_id'
  WHERE operation = 'create_deal'
    AND payload ? 'payment_id'
    AND dedup_key IS NULL;

-- Create the unique constraint.
-- NULLS NOT DISTINCT means two NULLs are treated as equal → deduplicates
-- upsert_contact and update_status per profile.
CREATE UNIQUE INDEX IF NOT EXISTS crm_sync_queue_dedup_uniq
  ON crm_sync_queue (profile_id, operation, dedup_key)
  NULLS NOT DISTINCT;

-- ── (b) crm_deal_enqueued_for_payment ────────────────────────────────────────
--
-- Lightweight sentinel table: one row per payment_id that has already had a
-- CRM deal enqueued (or successfully created). Prevents settlement-effects
-- retries from double-enqueuing deals.
CREATE TABLE IF NOT EXISTS crm_deal_enqueued_for_payment (
  payment_id   TEXT        NOT NULL PRIMARY KEY,
  profile_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enqueued_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Grant privileges to kunacademy_admin role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kunacademy_admin') THEN
    GRANT SELECT, INSERT, DELETE ON crm_deal_enqueued_for_payment TO kunacademy_admin;
  END IF;
END $$;

COMMIT;
