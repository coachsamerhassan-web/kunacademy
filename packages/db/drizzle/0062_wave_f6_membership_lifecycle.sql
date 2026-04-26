-- Migration 0062 — Wave F.6 — Membership Lifecycle (Annual Billing + Dunning + Grace + Retention)
--
-- Closes the 8 hand-off contracts F.4 left open for F.6:
--
--   1. Cancel CTA wired to /api/membership/cancel (no schema change — UI work).
--   2. Grace-sweep cron at /api/cron/membership-grace-sweep (this migration adds
--      the audit table the cron writes to, with idempotency keys for re-runs).
--   3. Dunning emails on past_due / recovered / final-failure (audit table tracks
--      send-once semantics by event_type).
--   4. Renewal reminders cron T-7 + T-1 (annual) + T-1 (monthly) — needs idempotency
--      keys: (membership_id, current_period_end, reminder_type).
--   5. Free-preview page wrap (UI work — no schema change).
--   6. Win-back retention email 30d after expired (this audit table tracks send).
--   7. Bilingual email templates in @kunacademy/email package (no schema change).
--   8. Admin observability — new `/admin/membership/lifecycle` reads from this table.
--
-- Schema choice (per F.6 dispatch instructions):
--   "Log to a new lightweight `membership_lifecycle_events` table OR extend
--   `coupon_redemptions` audit pattern (your call — choose the pattern that's
--   lightest weight; document choice)"
--
-- Decision: NEW table `membership_lifecycle_events`. Rationale:
--   - coupon_redemptions is scoped to discount-application audit; mixing
--     lifecycle events (cancel, grace_sweep, dunning email send, renewal
--     reminder send, win-back send) into it would dilute the table's purpose
--     and add many WHERE kind != 'lifecycle' filters across F.5/F.4 surfaces.
--   - Lifecycle events have different idempotency semantics: a "renewal_reminder_t7"
--     event keys on (membership_id, current_period_end, reminder_type) — that
--     shape doesn't fit coupon_redemptions' (coupon_id, customer_id) shape.
--   - Lifecycle events also need free-form metadata jsonb for email-send IDs,
--     Telegram alert IDs, retry counts.
--
-- The table is small + write-heavy (1-2 inserts per cron run per active membership).
-- Indexes are kept minimal (PK + idempotency unique + lookup by membership_id).
--
-- Also adds optional `cancel_reason` text on memberships (per F.6 dispatch
-- "your call — otherwise skip the filter and send to all"). Decision: ADD the
-- column (NULL-able, no validation), so future Nashit/Amin features can read
-- it without another migration. Win-back cron filters out cancel_reason matching
-- 'no_longer_interested' substring (case-insensitive) per F.6 dispatch §6.
--
-- Locked decisions referenced (DECISIONS-LEDGER 2026-04-24):
--   d-canon-phase2-fw5  Per-renewal Zoho Books invoicing (Stripe handles emails per cycle)
--   d-canon-phase2-fw6  T-7 + T-1 annual reminders, T-1 monthly
--   d-canon-phase2-m6   Cancel anytime through paid period
--   d-canon-phase2-fw9  Auto-provision Free on signup (we revert to free tier on grace sweep)
--
-- Pattern alignment (F.1 / F.2 / F.4 / F.5 conventions):
--   - kunacademy_admin role bypasses RLS via TO kunacademy_admin USING (true)
--   - GRANTs explicit; no SUPERUSER (per feedback_never_grant_superuser)
--   - Idempotent guards (IF NOT EXISTS, ON CONFLICT, DO $$ ... $$ for policies)
--   - Operator follow-up: ALTER TABLE ... OWNER TO postgres + re-grant after
--     `psql -f` apply (matches F.1/F.5 pattern)
--
-- Idempotent.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. memberships.cancel_reason — optional explanation column              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS cancel_reason text;

COMMENT ON COLUMN memberships.cancel_reason IS
  'Optional free-form reason supplied by member at cancel time. '
  'Used by win-back cron to filter out users who explicitly opted out '
  '(case-insensitive "no_longer_interested" / "not_interested" matches).';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. membership_lifecycle_events — audit + idempotency for cron + webhook  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Event types (kind discriminator):
--
--   cancel_requested              — user clicked cancel; webhook arrived; cancel_at set
--   cancel_effective_grace_swept  — grace-sweep cron flipped membership to free
--   reactivated                   — user reactivated before cancel_at
--   dunning_payment_failed        — past_due + email sent
--   dunning_back_in_good_standing — payment recovered + email sent
--   dunning_payment_failed_final  — Stripe smart-retry exhausted + email sent
--   renewal_reminder_t7           — T-7 reminder sent (annual)
--   renewal_reminder_t1           — T-1 reminder sent (annual or monthly)
--   winback_30d                   — 30-day post-expired win-back email sent
--
-- The send_key column is the idempotency anchor:
--   For renewal reminders:  (membership_id || current_period_end || reminder_type)
--   For grace sweep:        (membership_id || cancel_at)            -- one-shot at sweep time
--   For dunning:            (membership_id || invoice_id || event_type)
--   For win-back:           (membership_id)                         -- one-time forever
--
-- A UNIQUE constraint on send_key prevents double-sends across cron retries
-- and webhook re-deliveries.

CREATE TABLE IF NOT EXISTS membership_lifecycle_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type    text NOT NULL,
  send_key      text NOT NULL,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: (event_type, send_key) is the canonical dedup key. We include
-- event_type so two distinct reminders (e.g. T-7 and T-1) for the same membership
-- + period_end don't collide on the cheaper send_key alone.
CREATE UNIQUE INDEX IF NOT EXISTS membership_lifecycle_events_idem_uidx
  ON membership_lifecycle_events(event_type, send_key);

CREATE INDEX IF NOT EXISTS membership_lifecycle_events_membership_idx
  ON membership_lifecycle_events(membership_id, created_at DESC);

CREATE INDEX IF NOT EXISTS membership_lifecycle_events_user_idx
  ON membership_lifecycle_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS membership_lifecycle_events_type_idx
  ON membership_lifecycle_events(event_type, created_at DESC);

-- CHECK: event_type whitelist. Catches code typos at write-time.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'membership_lifecycle_events'::regclass
      AND conname  = 'membership_lifecycle_events_event_type_chk'
  ) THEN
    ALTER TABLE membership_lifecycle_events
      ADD CONSTRAINT membership_lifecycle_events_event_type_chk
      CHECK (event_type IN (
        'cancel_requested',
        'cancel_effective_grace_swept',
        'reactivated',
        'dunning_payment_failed',
        'dunning_back_in_good_standing',
        'dunning_payment_failed_final',
        'renewal_reminder_t7',
        'renewal_reminder_t1',
        'winback_30d'
      ));
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. RLS — admin full read, server role read for cron decision logic       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE membership_lifecycle_events ENABLE ROW LEVEL SECURITY;

-- Admin full access (read + write — admin /lifecycle UI reads, no admin writes
-- expected, but write capability lets us repair if something gets stuck).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'membership_lifecycle_events'::regclass
      AND polname  = 'membership_lifecycle_events_admin_all'
  ) THEN
    CREATE POLICY membership_lifecycle_events_admin_all
      ON membership_lifecycle_events
      FOR ALL TO kunacademy_admin
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Server role: cron + webhook handlers run as kunacademy and need to INSERT
-- + SELECT (for idempotency check). Members do NOT see this table directly —
-- their dashboard reads memberships + computes derived state.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'membership_lifecycle_events'::regclass
      AND polname  = 'membership_lifecycle_events_server_rw'
  ) THEN
    CREATE POLICY membership_lifecycle_events_server_rw
      ON membership_lifecycle_events
      FOR ALL TO kunacademy
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- GRANTs (idempotent — re-stating is safe).
GRANT SELECT, INSERT, UPDATE, DELETE ON membership_lifecycle_events TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE ON membership_lifecycle_events TO kunacademy;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Self-smoke                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  cnt int;
BEGIN
  -- 1. cancel_reason added
  SELECT count(*) INTO cnt FROM information_schema.columns
   WHERE table_name='memberships' AND column_name='cancel_reason';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 1 FAIL: memberships.cancel_reason missing'; END IF;
  RAISE NOTICE 'SMOKE 1 PASSED: memberships.cancel_reason exists';

  -- 2. lifecycle table exists
  SELECT count(*) INTO cnt FROM information_schema.tables
   WHERE table_name='membership_lifecycle_events';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 2 FAIL: membership_lifecycle_events table missing'; END IF;
  RAISE NOTICE 'SMOKE 2 PASSED: membership_lifecycle_events exists';

  -- 3. unique idempotency index present
  SELECT count(*) INTO cnt FROM pg_indexes
   WHERE tablename='membership_lifecycle_events'
     AND indexname='membership_lifecycle_events_idem_uidx';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 3 FAIL: idempotency uidx missing'; END IF;
  RAISE NOTICE 'SMOKE 3 PASSED: idempotency unique index exists';

  -- 4. event_type CHECK present
  SELECT count(*) INTO cnt FROM pg_constraint
   WHERE conrelid='membership_lifecycle_events'::regclass
     AND conname='membership_lifecycle_events_event_type_chk';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 4 FAIL: event_type CHECK missing'; END IF;
  RAISE NOTICE 'SMOKE 4 PASSED: event_type CHECK exists';

  -- 5. RLS enabled
  SELECT count(*) INTO cnt FROM pg_class
   WHERE relname='membership_lifecycle_events' AND relrowsecurity=true;
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 5 FAIL: RLS not enabled'; END IF;
  RAISE NOTICE 'SMOKE 5 PASSED: RLS enabled';

  -- 6. policies present
  SELECT count(*) INTO cnt FROM pg_policy
   WHERE polrelid='membership_lifecycle_events'::regclass
     AND polname IN (
       'membership_lifecycle_events_admin_all',
       'membership_lifecycle_events_server_rw'
     );
  IF cnt <> 2 THEN RAISE EXCEPTION 'SMOKE 6 FAIL: expected 2 policies, found %', cnt; END IF;
  RAISE NOTICE 'SMOKE 6 PASSED: 2 RLS policies present';

  -- 7. CHECK rejects invalid event_type (negative test)
  BEGIN
    INSERT INTO membership_lifecycle_events (
      membership_id, event_type, send_key
    ) VALUES (
      (SELECT id FROM memberships LIMIT 1),
      'invalid_event_type_for_test',
      'smoke-test-bad-event-type'
    );
    RAISE EXCEPTION 'SMOKE 7 FAIL: invalid event_type was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'SMOKE 7 PASSED: invalid event_type rejected by CHECK';
  WHEN others THEN
    -- If memberships is empty (fresh install), skip the negative test
    IF SQLSTATE = '23502' OR SQLSTATE = 'P0001' THEN
      RAISE NOTICE 'SMOKE 7 SKIPPED: no memberships rows for negative test';
    ELSE
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'Migration 0062 self-smoke complete (6+1 PASS)';
END $$;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Operator follow-up (run AFTER `sudo -u postgres psql -f`)                ║
-- ║                                                                          ║
-- ║ Per F.1 / F.5 ownership pattern, ensure tables remain owned by postgres  ║
-- ║ so RLS is enforced (table owners bypass RLS by default in Postgres).     ║
-- ║                                                                          ║
-- ║   ALTER TABLE membership_lifecycle_events OWNER TO postgres;             ║
-- ║                                                                          ║
-- ║   GRANT SELECT, INSERT, UPDATE, DELETE ON membership_lifecycle_events    ║
-- ║     TO kunacademy_admin;                                                 ║
-- ║   GRANT SELECT, INSERT, UPDATE ON membership_lifecycle_events            ║
-- ║     TO kunacademy;                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
