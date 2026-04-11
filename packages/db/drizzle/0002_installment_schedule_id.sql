-- Migration: Wave S0 Block C Phase 4 — Installment Wiring (Task #12)
-- Date: 2026-04-11
-- DO NOT run manually — apply via: pnpm --filter @kunacademy/db db:push
-- or via Supabase dashboard SQL editor (all ADD COLUMN operations are non-destructive).

-- ── payment_schedules additions ───────────────────────────────────────────────

ALTER TABLE payment_schedules
  ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id TEXT;

-- Allows direct admin lookup of the Stripe SubscriptionSchedule object for
-- pause/cancel operations and reconciliation. Populated when schedule_type = 'installment'
-- and gateway = 'stripe'. NULL for Tabby (merchant receives full amount upfront).

CREATE INDEX IF NOT EXISTS idx_payment_schedules_stripe_schedule_id
  ON payment_schedules (stripe_subscription_schedule_id)
  WHERE stripe_subscription_schedule_id IS NOT NULL;

-- ── payments status vocabulary ────────────────────────────────────────────────

-- New status value enabled by this migration:
--   'active_installment' — first installment settled, remaining payments pending.
--                          Set by invoice.paid webhook on installment #1.
--                          Transitions to 'completed' when last invoice.paid fires.
-- No schema change needed — payments.status is TEXT.
-- Documentation only:
-- VALID STATUSES: 'pending' | 'completed' | 'failed' | 'active_installment'

-- ── Stripe subscription_schedule_id in payments.metadata ─────────────────────
-- NOTE: subscription_schedule_id is stored in payments.metadata (JSONB) as:
--   { "subscription_schedule_id": "sub_sched_xxx", "stripe_customer_id": "cus_xxx" }
-- No column migration needed — metadata is already JSONB.
-- This is intentional: the schedule ID is only relevant during the installment lifecycle,
-- and JSONB avoids schema churn for what is effectively a runtime identifier.
