-- Migration 0061 — Wave F.4 — Member Dashboard + Entitlement Gating
--
-- Closes the four hand-off contracts F.5 left open for F.4:
--
--   1. Auto-coupon kind discriminator on `coupons` table.
--      F.5's coupons table has no source/kind discriminator; F.4 introduces
--      `kind ENUM('manual','member_auto')` so we can distinguish admin-issued
--      coupons from per-member auto-generated `MEMBER-10-<hash>` codes.
--      Backfill: all existing rows = 'manual'.
--
--   2. Member-link FK on `coupons` table.
--      Per-member auto-coupons need a hard link back to the membership that
--      generated them. Adding `membership_id` (nullable; only set for kind=
--      'member_auto') with FK to memberships(id) ON DELETE SET NULL preserves
--      audit trail if membership row is later cleaned up.
--
--   3. Audit kind on `coupon_redemptions` table.
--      F.5 hand-off note: "kind:'member' returns no redemption row by design
--      (no coupon row exists). F.4 decides: separate audit table OR extend
--      coupon_redemptions with kind:'member'|'coupon'."
--      Decision: extend `coupon_redemptions` (one audit table is simpler than
--      two). Adds `kind ENUM('coupon','member')` column. Backfill all existing
--      rows to 'coupon'. When `resolveBestDiscount` returns kind:'member', the
--      checkout code path now writes a redemption row with kind='member' and
--      coupon_id set to the member-tier auto-coupon's id (so we have a real FK
--      target — see contract #1 above; auto-coupons are real coupon rows).
--      Even when no coupon was used (member discount applied directly via
--      hardcoded path), we INSERT with coupon_id = NULL by relaxing the
--      NOT NULL constraint on coupon_id — the partial unique index already
--      handles the WHERE customer_id IS NOT NULL case correctly because
--      coupon_id is part of its key.
--
--   4. Stripe Promotion Codes mirroring decision (DOCUMENTED — no schema change).
--      Decision: do NOT mirror coupons → Stripe Promotion Codes at this stage.
--      Rationale: (a) the membership 10% auto-discount path runs at our
--      checkout layer, not Stripe Checkout; (b) per-member auto-coupons are
--      consumed at our `/api/checkout/apply-coupon`, also not Stripe; (c)
--      mirroring adds round-trip latency, a failure mode where the two systems
--      could diverge, and Stripe rate-limit pressure. If a future flow needs
--      Stripe-side promotion codes (e.g. Stripe Checkout for membership-
--      subscribe gives 10% off the subscription via promotion code), it can be
--      added behind a feature flag in `lib/stripe-promotion-mirror.ts` without
--      requiring schema change. This is captured here for the wave audit
--      trail.
--
-- Locked decisions referenced (DECISIONS-LEDGER 2026-04-24):
--   d-canon-phase2-m3   Paid-1 unlocks body-foundations + compass-work +
--                        community-write + monthly Q&A
--   d-canon-phase2-fw8  Free community = read-only
--   d-canon-phase2-fw9  Auto-provision Free on signup
--   d-canon-phase2-fw10 Zoom + VPS storage; separate AR/EN monthly Q&A
--   d-canon-phase2-f5   Strict entitlement; no Free preview of Paid
--
-- Pattern alignment (F.1 / F.2 / F.5 conventions):
--   - kunacademy_admin role bypasses RLS via `TO kunacademy_admin USING (true)`
--   - GRANTs explicit; no SUPERUSER (per `feedback_never_grant_superuser`)
--   - Idempotent guards (IF NOT EXISTS, ON CONFLICT, DO $$ ... $$ for policies)
--   - Operator follow-up: ALTER TABLE ... OWNER TO postgres + re-grant after
--     `psql -f` apply (matches F.5 pattern; documented at end of file)
--
-- Idempotent.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Extend coupons — kind discriminator + membership FK                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Add kind column. Existing rows backfilled to 'manual' via DEFAULT,
-- then constraint added. New CHECK via ADD CONSTRAINT lets us detect
-- accidental writes of unknown kinds.
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'manual';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'coupons'::regclass
      AND conname  = 'coupons_kind_check'
  ) THEN
    ALTER TABLE coupons
      ADD CONSTRAINT coupons_kind_check
      CHECK (kind IN ('manual','member_auto'));
  END IF;
END $$;

-- Add membership_id FK. Nullable; only populated for kind='member_auto'.
-- ON DELETE SET NULL preserves the coupon row if the membership is hard-deleted
-- (rare path; default is soft-cancel via ended_at).
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS coupons_membership_id_idx
  ON coupons(membership_id)
  WHERE membership_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coupons_kind_idx
  ON coupons(kind);

-- Logical-consistency CHECK: member_auto coupons MUST have a membership_id;
-- manual coupons MUST NOT (it's nonsensical for a manual coupon to be
-- mem-linked). Catches code bugs at write-time.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'coupons'::regclass
      AND conname  = 'coupons_kind_membership_consistency_chk'
  ) THEN
    ALTER TABLE coupons
      ADD CONSTRAINT coupons_kind_membership_consistency_chk
      CHECK (
        (kind = 'manual'      AND membership_id IS NULL)
        OR
        (kind = 'member_auto' AND membership_id IS NOT NULL)
      );
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Extend coupon_redemptions — kind discriminator                        ║
-- ║                                                                          ║
-- ║   F.5's table assumes every redemption is a coupon redemption. F.4       ║
-- ║   needs to record member-tier auto-discount applications too, so we      ║
-- ║   add `kind ENUM('coupon','member')` and relax coupon_id to nullable.    ║
-- ║                                                                          ║
-- ║   Rules:                                                                 ║
-- ║     kind='coupon' → coupon_id REQUIRED                                   ║
-- ║     kind='member' → coupon_id REQUIRED (member-auto coupon row exists)   ║
-- ║                      OR coupon_id NULL (legacy hardcoded member discount ║
-- ║                      path, preserved for resolveBestDiscount return      ║
-- ║                      shape kind:'member' source_id:null)                 ║
-- ║   The CHECK constraint guards by-kind invariants explicitly so future    ║
-- ║   code paths can't write a degenerate row.                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE coupon_redemptions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'coupon';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'coupon_redemptions'::regclass
      AND conname  = 'coupon_redemptions_kind_check'
  ) THEN
    ALTER TABLE coupon_redemptions
      ADD CONSTRAINT coupon_redemptions_kind_check
      CHECK (kind IN ('coupon','member'));
  END IF;
END $$;

-- Relax coupon_id from NOT NULL → NULL (so kind='member' with no coupon row
-- can be recorded as a pure-member-discount audit entry).
ALTER TABLE coupon_redemptions
  ALTER COLUMN coupon_id DROP NOT NULL;

-- The existing `coupon_redemptions_coupon_id_fkey` is ON DELETE CASCADE.
-- Keep it: when a coupon row is deleted, redemption rows for that coupon
-- are removed too. For kind='member' with NULL coupon_id, FK isn't checked.
-- We DO want kind='coupon' to require non-null coupon_id; enforce via CHECK.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'coupon_redemptions'::regclass
      AND conname  = 'coupon_redemptions_kind_coupon_consistency_chk'
  ) THEN
    ALTER TABLE coupon_redemptions
      ADD CONSTRAINT coupon_redemptions_kind_coupon_consistency_chk
      CHECK (
        (kind = 'coupon' AND coupon_id IS NOT NULL)
        OR
        (kind = 'member')                              -- coupon_id may be NULL or set
      );
  END IF;
END $$;

-- The existing partial unique index `coupon_redemptions_single_use_uidx` is
-- on (coupon_id, customer_id) WHERE customer_id IS NOT NULL. That index
-- naturally tolerates NULL coupon_id rows (NULL ≠ anything in unique-index
-- semantics) — kind='member' with coupon_id NULL never collides. For
-- kind='member' with coupon_id SET (member-auto coupon path), we still want
-- the same single-use-per-customer guard, and the existing index serves that
-- purpose because (coupon_id, customer_id) WHERE customer_id IS NOT NULL
-- already covers it.

CREATE INDEX IF NOT EXISTS coupon_redemptions_kind_idx
  ON coupon_redemptions(kind, redeemed_at DESC);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. RLS / GRANTs touch-up                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- coupons + coupon_redemptions already have RLS enabled in 0060.
-- Adding columns inherits the existing policies. No new policies needed.
-- GRANTs unchanged (the new columns auto-grant via inheritance from the table-
-- level GRANT in 0060).

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Self-smoke                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
   WHERE table_name='coupons' AND column_name='kind';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 1 FAIL: coupons.kind missing'; END IF;
  RAISE NOTICE 'SMOKE 1 PASSED: coupons.kind exists';

  SELECT count(*) INTO cnt FROM information_schema.columns
   WHERE table_name='coupons' AND column_name='membership_id';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 2 FAIL: coupons.membership_id missing'; END IF;
  RAISE NOTICE 'SMOKE 2 PASSED: coupons.membership_id exists';

  SELECT count(*) INTO cnt FROM information_schema.columns
   WHERE table_name='coupon_redemptions' AND column_name='kind';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 3 FAIL: coupon_redemptions.kind missing'; END IF;
  RAISE NOTICE 'SMOKE 3 PASSED: coupon_redemptions.kind exists';

  -- coupon_id should now be nullable
  SELECT count(*) INTO cnt FROM information_schema.columns
   WHERE table_name='coupon_redemptions' AND column_name='coupon_id'
     AND is_nullable='YES';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 4 FAIL: coupon_redemptions.coupon_id should be NULLABLE'; END IF;
  RAISE NOTICE 'SMOKE 4 PASSED: coupon_redemptions.coupon_id is nullable';

  -- All existing redemption rows must have kind='coupon' (backfill check)
  SELECT count(*) INTO cnt FROM coupon_redemptions WHERE kind <> 'coupon';
  IF cnt <> 0 THEN RAISE EXCEPTION 'SMOKE 5 FAIL: % rows have non-coupon kind backfilled', cnt; END IF;
  RAISE NOTICE 'SMOKE 5 PASSED: all existing redemption rows backfilled to kind=coupon';

  -- All existing coupons must have kind='manual' (backfill check)
  SELECT count(*) INTO cnt FROM coupons WHERE kind <> 'manual';
  IF cnt <> 0 THEN RAISE EXCEPTION 'SMOKE 6 FAIL: % rows have non-manual kind backfilled', cnt; END IF;
  RAISE NOTICE 'SMOKE 6 PASSED: all existing coupons backfilled to kind=manual';

  RAISE NOTICE 'Migration 0061 self-smoke complete (6/6 PASS)';
END $$;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Operator follow-up (run AFTER `sudo -u postgres psql -f`)                ║
-- ║                                                                          ║
-- ║ Per F.1 / F.5 ownership pattern, ensure tables remain owned by postgres  ║
-- ║ so RLS is enforced (table owners bypass RLS by default in Postgres).     ║
-- ║ The two ALTER TABLE statements below are ALREADY APPLIED on existing     ║
-- ║ tables (by 0060 operator step), but re-stating is safe + idempotent.     ║
-- ║ Re-run after 0061 apply just to be defensive:                            ║
-- ║                                                                          ║
-- ║   ALTER TABLE coupons OWNER TO postgres;                                 ║
-- ║   ALTER TABLE coupon_redemptions OWNER TO postgres;                      ║
-- ║                                                                          ║
-- ║   GRANT SELECT, INSERT, UPDATE ON coupons TO kunacademy_admin;           ║
-- ║   GRANT SELECT, INSERT, UPDATE ON coupon_redemptions TO kunacademy_admin;║
-- ║   GRANT SELECT ON coupons TO kunacademy, authenticated;                  ║
-- ║   GRANT SELECT ON coupon_redemptions TO kunacademy, authenticated;       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
