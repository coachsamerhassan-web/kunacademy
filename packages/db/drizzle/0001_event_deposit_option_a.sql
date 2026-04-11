-- Migration: Wave S0 Block C Phase 4 — Event Deposit Option A
-- Date: 2026-04-11
-- DO NOT run manually — apply via: pnpm --filter @kunacademy/db db:push
-- or via Supabase dashboard SQL editor (safe to run: all ADD COLUMN operations are non-destructive).

-- ── event_registrations additions ────────────────────────────────────────────

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS deposit_amount               INTEGER,
  ADD COLUMN IF NOT EXISTS deposit_paid_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_amount               INTEGER,
  ADD COLUMN IF NOT EXISTS balance_due_date             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_paid_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_percentage           INTEGER,
  ADD COLUMN IF NOT EXISTS balance_due_days_before_event INTEGER;

-- Existing rows: all columns remain NULL, which correctly models "no deposit used."
-- status values in use: 'registered', 'confirmed', 'pending_payment', 'waitlisted'
-- New status values this migration makes possible: 'deposit_paid', 'fully_paid'
-- (no ENUM change needed — status is TEXT).

-- ── payments additions ────────────────────────────────────────────────────────

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS event_registration_id UUID;

-- NOTE: No FK constraint added on payments.event_registration_id → event_registrations.id.
-- Reason: event_registrations already has payment_id → payments.id (existing FK).
-- Adding the reverse FK would create a circular dependency that requires deferrable constraints.
-- Application-layer integrity is sufficient here — the webhook looks up by metadata first,
-- and falls back to this column for balance payments. Audits can cross-check via:
--   SELECT * FROM payments p
--   JOIN event_registrations er ON er.id = p.event_registration_id
--   WHERE p.event_registration_id IS NOT NULL;

-- ── Index for webhook lookups ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payments_event_registration_id
  ON payments (event_registration_id)
  WHERE event_registration_id IS NOT NULL;
