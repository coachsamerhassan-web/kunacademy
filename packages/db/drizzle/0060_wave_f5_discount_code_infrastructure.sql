-- Migration 0060 — Wave F.5 — Discount Code Infrastructure (coupons + redemptions)
--
-- Adds 2 new tables for the membership-aware discount/coupon system:
--   1. coupons              — admin-created promo codes (% or fixed-AED, scope-aware)
--   2. coupon_redemptions   — append-only redemption log; FK to orders + customers
--
-- Locked decisions referenced (DECISIONS-LEDGER 2026-04-24):
--   F-W3 (single-discount-wins): if member discount + coupon both apply,
--                                 use the larger absolute reduction. No stacking.
--                                 Enforcement = library layer (lib/discounts/).
--   F-W4 (ineligible programs):  STFC + entrepreneurs-6hr never receive
--                                 member discount NOR member-tier coupons.
--                                 They CAN accept admin-issued one-off coupons
--                                 with `admin_override = true`.
--   M4   (member discount):      10% on big programs for Paid-1 (Associate) tier.
--                                 Auto-applied at checkout.
--                                 Honored by the existing membership_discount path
--                                 (NOT this coupon table) — coupons are admin-issued.
--
-- Coupon scope semantics:
--   scope_kind = 'all'              — applies to every program / cart line
--   scope_kind = 'programs'         — applies only when cart contains a program
--                                     whose id is in scope_program_ids
--   scope_kind = 'tiers'            — applies only to coaching-1on1 carts whose
--                                     program.coach_tier is in scope_tier_ids
--
-- Single-use semantics:
--   single_use_per_customer = true  — same customer can redeem at most once
--   redemptions_max IS NOT NULL     — cap on global redemption count
--   valid_from / valid_to NULL      — open-ended
--
-- Admin-issued one-off escape hatch (F-W4):
--   admin_override = true           — bypasses programs.member_discount_eligible
--                                     check, so admin can offer STFC / entrepreneurs
--                                     discount-coupon promotions when justified.
--
-- IP-protection:
--   coupon descriptions are admin-text only and rendered ONLY in admin UI.
--   No program methodology copy is ever written to coupons. Pre-commit
--   `lint-dignity-framing.ts` covers the check.
--
-- Pattern alignment (F.1 / F.2 conventions):
--   - kunacademy_admin role bypasses RLS via `TO kunacademy_admin USING (true)`
--   - GRANTs explicit; no SUPERUSER (per `feedback_never_grant_superuser`)
--   - Idempotent guards (IF NOT EXISTS, ON CONFLICT, DO $$ ... $$ for policies/triggers)
--
-- Idempotent.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. coupons — admin-created promo codes                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS coupons (
  id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Code: case-normalized to uppercase by application layer.
  -- CHECK enforces uppercase letters / digits / hyphen, 4–32 chars.
  code                     text         NOT NULL UNIQUE
                                        CHECK (
                                          code ~ '^[A-Z0-9][A-Z0-9-]{3,31}$'
                                        ),
  -- 'percentage' (1–100) or 'fixed' (value_cents in `currency`).
  type                     text         NOT NULL
                                        CHECK (type IN ('percentage','fixed')),
  -- For percentage: value 1–100. For fixed: value = minor units (cents).
  value                    integer      NOT NULL CHECK (value > 0),
  -- For fixed: required currency. For percentage: NULL (currency-agnostic).
  currency                 text                                            -- 'AED' | 'EGP' | 'USD' | 'EUR' | NULL
                                        CHECK (currency IS NULL
                                               OR currency IN ('AED','EGP','USD','EUR')),
  -- Redemption caps
  redemptions_max          integer      CHECK (redemptions_max IS NULL OR redemptions_max > 0),
  redemptions_used         integer      NOT NULL DEFAULT 0
                                        CHECK (redemptions_used >= 0),
  -- Validity window (NULL = open-ended)
  valid_from               timestamptz,
  valid_to                 timestamptz,
  -- Per-customer single-use flag
  single_use_per_customer  boolean      NOT NULL DEFAULT false,
  -- Scope
  scope_kind               text         NOT NULL DEFAULT 'all'
                                        CHECK (scope_kind IN ('all','programs','tiers')),
  scope_program_ids        uuid[]       NOT NULL DEFAULT ARRAY[]::uuid[],
  scope_tier_ids           uuid[]       NOT NULL DEFAULT ARRAY[]::uuid[],
  -- F-W4 escape hatch — bypasses programs.member_discount_eligible filter
  admin_override           boolean      NOT NULL DEFAULT false,
  -- Lifecycle
  is_active                boolean      NOT NULL DEFAULT true,
  description              text         CHECK (description IS NULL
                                               OR char_length(description) <= 500),
  created_by               uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now(),

  -- Sanity: percentage value must fit 1–100
  CONSTRAINT coupons_percentage_range_chk
    CHECK (type <> 'percentage' OR (value >= 1 AND value <= 100)),

  -- Sanity: fixed coupon must declare currency
  CONSTRAINT coupons_fixed_currency_chk
    CHECK (type <> 'fixed' OR currency IS NOT NULL),

  -- Sanity: validity window order
  CONSTRAINT coupons_validity_order_chk
    CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to > valid_from),

  -- Sanity: redemptions_used <= redemptions_max (when bounded)
  CONSTRAINT coupons_redemptions_cap_chk
    CHECK (redemptions_max IS NULL OR redemptions_used <= redemptions_max)
);

CREATE INDEX IF NOT EXISTS coupons_code_uidx
  ON coupons (code);

CREATE INDEX IF NOT EXISTS coupons_active_idx
  ON coupons (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS coupons_validity_idx
  ON coupons (valid_from, valid_to)
  WHERE is_active = true;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. coupon_redemptions — append-only redemption log                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Coupon reference; CASCADE on coupon delete (rare; kept tight)
  coupon_id       uuid         NOT NULL
                               REFERENCES coupons(id) ON DELETE CASCADE,
  -- Customer reference; SET NULL on profile delete preserves audit trail
  customer_id     uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  -- Order reference; SET NULL on order delete (orders are append-only in practice)
  order_id        uuid         REFERENCES orders(id) ON DELETE SET NULL,
  -- Snapshot of the discount applied (post-resolution)
  amount_applied  integer      NOT NULL CHECK (amount_applied >= 0),  -- minor units
  currency        text         NOT NULL
                               CHECK (currency IN ('AED','EGP','USD','EUR')),
  redeemed_at     timestamptz  NOT NULL DEFAULT now()
);

-- Single-use-per-customer enforcement: partial unique index on
-- (coupon_id, customer_id) where customer_id is not null.
-- Race-condition-safe — Postgres serializes index inserts.
CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_single_use_uidx
  ON coupon_redemptions (coupon_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx
  ON coupon_redemptions (coupon_id, redeemed_at DESC);

CREATE INDEX IF NOT EXISTS coupon_redemptions_customer_idx
  ON coupon_redemptions (customer_id, redeemed_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coupon_redemptions_order_idx
  ON coupon_redemptions (order_id)
  WHERE order_id IS NOT NULL;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ updated_at trigger                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION coupons_touch_updated_at() RETURNS trigger AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'coupons_touch_updated_at'
  ) THEN
    CREATE TRIGGER coupons_touch_updated_at
      BEFORE UPDATE ON coupons
      FOR EACH ROW EXECUTE FUNCTION coupons_touch_updated_at();
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Row-Level Security                                                       ║
-- ║   coupons: authenticated read for validation; admin write                ║
-- ║   coupon_redemptions: customer reads own; admin all                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE coupons              ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions   ENABLE ROW LEVEL SECURITY;

-- ── coupons ───────────────────────────────────────────────────────────────────
-- Authenticated users can SELECT active coupons (for validation at checkout).
-- They cannot enumerate inactive / hidden ones. Admin has full access.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='coupons' AND policyname='coupons_authenticated_read'
  ) THEN
    CREATE POLICY coupons_authenticated_read ON coupons FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='coupons' AND policyname='coupons_admin_all'
  ) THEN
    CREATE POLICY coupons_admin_all ON coupons FOR ALL
      TO kunacademy_admin USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── coupon_redemptions ────────────────────────────────────────────────────────
-- Customer reads only their own redemptions. Admin sees all. Server role
-- (kunacademy) can insert via the apply-coupon flow (RLS-bypassed via admin
-- context in the API route, but having a proper policy here protects against
-- direct-server inserts that forget the context wrapper).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='coupon_redemptions' AND policyname='coupon_redemptions_owner_read'
  ) THEN
    CREATE POLICY coupon_redemptions_owner_read ON coupon_redemptions FOR SELECT
      TO authenticated
      USING (customer_id = app_uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='coupon_redemptions' AND policyname='coupon_redemptions_admin_all'
  ) THEN
    CREATE POLICY coupon_redemptions_admin_all ON coupon_redemptions FOR ALL
      TO kunacademy_admin USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ GRANTs (never SUPERUSER; always explicit)                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- kunacademy (app role): authenticated read on coupons (RLS-narrowed),
-- read own redemptions (RLS-narrowed). All coupon writes + redemption inserts
-- happen via withAdminContext (kunacademy_admin role) in the API layer.
GRANT SELECT ON coupons TO kunacademy;
GRANT SELECT ON coupon_redemptions TO kunacademy;

-- DeepSeek QA fix (MEDIUM, 2026-04-26): the RLS policies are TO authenticated,
-- but Supabase-style authenticated users would lack table-level SELECT without
-- a matching GRANT. The codebase uses NextAuth + server-side API + withAdminContext
-- (not direct client→DB), so this never fires today. Adding the GRANT is purely
-- defensive: if a future surface ever wires a direct authenticated read, the RLS
-- policy will work as documented. Same hardening should be applied to the F.1
-- tables (tiers/features/tier_features/memberships) — tracked separately.
GRANT SELECT ON coupons             TO authenticated;
GRANT SELECT ON coupon_redemptions  TO authenticated;

-- kunacademy_admin: full CRUD on coupons + redemptions
GRANT SELECT, INSERT, UPDATE, DELETE ON coupons             TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON coupon_redemptions  TO kunacademy_admin;

COMMIT;
