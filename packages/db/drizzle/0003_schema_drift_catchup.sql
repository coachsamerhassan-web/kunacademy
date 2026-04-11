-- Migration: Wave S0 Phase 6 — Schema drift catchup
-- Date: 2026-04-11 session 4c
-- Applied manually on VPS (72.61.110.211) via psql during Phase 6 acceptance testing.
-- Committed to the repo for future deploys so the drift doesn't recur.
--
-- Drift source: Phase 4 commits (2d740c6, d1cac8c) updated the drizzle TypeScript
-- schema files but did not ship matching SQL migrations. Symptoms surfaced during
-- Phase 6 dynamic testing when authenticated probes hit:
--   - earnings.payment_id / earnings.referrer_id "column does not exist"
--   - credit_transactions.currency "column does not exist"
--   - earnings_source_type_check rejected new values like 'course_payment'
--
-- All operations are non-destructive: ADD COLUMN IF NOT EXISTS, CHECK constraint
-- replacement (existing rows with legacy values continue to pass), GRANT additions.

-- ── earnings: add payment_id + referrer_id, relax source_type check ─────────
ALTER TABLE earnings
  ADD COLUMN IF NOT EXISTS payment_id UUID,
  ADD COLUMN IF NOT EXISTS referrer_id UUID;

ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_source_type_check;
ALTER TABLE earnings ADD CONSTRAINT earnings_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'service_booking', 'product_sale', 'referral',
    'course_payment', 'event_deposit', 'event_payment',
    'installment_payment', 'booking_payment', 'product_payment'
  ]));

CREATE INDEX IF NOT EXISTS idx_earnings_payment_id
  ON earnings (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_earnings_source
  ON earnings (source_id, source_type);

-- ── credit_transactions: add currency column ─────────────────────────────────
-- Default 'aed' for backward compatibility with rows written before this column.
ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'aed';

-- ── payments: relax status check to include 'active_installment' ─────────────
-- New status set by invoice.paid webhook on Stripe Subscription Schedule
-- installment #1; transitions to 'completed' when the last invoice.paid fires.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status = ANY (ARRAY[
    'pending', 'completed', 'failed', 'refunded', 'active_installment'
  ]));

-- ── event_registrations: relax status check for deposit + waitlist flows ────
-- New values: 'waitlisted' (event capacity reached), 'deposit_paid' (partial),
-- 'fully_paid' (deposit + balance settled). No ENUM change — status is TEXT.
ALTER TABLE event_registrations DROP CONSTRAINT IF EXISTS event_registrations_status_check;
ALTER TABLE event_registrations ADD CONSTRAINT event_registrations_status_check
  CHECK (status = ANY (ARRAY[
    'registered', 'pending_payment', 'confirmed', 'cancelled',
    'waitlisted', 'deposit_paid', 'fully_paid'
  ]));

-- ── auth_users + friends: grant to kunacademy_admin (RLS bypass role) ───────
-- The 20260406020000_auth_tables.sql migration granted only to service_role and
-- authenticated, but the app connects as kunacademy and uses SET LOCAL ROLE
-- kunacademy_admin (via withAdminContext) for auth queries. Without these grants,
-- every credentials sign-in attempt fails with 42501 "permission denied for
-- table auth_users".
GRANT SELECT, INSERT, UPDATE, DELETE
  ON auth_users, auth_accounts, auth_sessions, auth_verification_tokens
  TO kunacademy_admin;
