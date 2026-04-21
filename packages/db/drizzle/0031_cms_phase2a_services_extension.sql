-- Migration 0031: CMS→DB Phase 2a — services extension
--
-- Extends existing `services` table to cover remaining CMS Service fields.
-- Mirrors the Phase 1a pattern (migration 0029): ADD COLUMN IF NOT EXISTS, idempotent,
-- explicit GRANTs preserved, RLS untouched (services already has policies from 0011).
--
-- Mapping from plan to columns (plan ref: CMS-TO-DB-MIGRATION-PLAN.md):
--   - bundle_id              → text, nullable (CMS Service.bundle_id)
--   - discount               → discount_percentage int + discount_valid_until date (CMS pair)
--   - installment            → installment_enabled bool default false (CMS Service.installment_enabled)
--   - coach_level            → coach_level_min text + coach_level_exact text (CMS uses two fields;
--                               existing DB has eligible_kun_levels[] which stays — this preserves
--                               both the array-eligibility model AND the CMS textual min/exact model)
--   - icf_credential_target  → text, nullable (CMS Service.icf_credential_target)
--
-- Additional CMS fields also present in services.json that have NO DB equivalent yet;
-- added here for 1:1 parity so DbContentProvider.getAllServices can return the full CMS shape:
--   - coach_slug             → text (pin a service to a specific coach's slug when non-null)
--   - display_order          → int default 0 (sort key; CMS uses it for ordering listings)
--   - is_free                → bool default false (CMS convenience flag — does not replace price_* fields)
--   - student_only           → bool default false (restrict visibility to enrolled students)
--   - program_slug           → text (link a service/package to a program e.g. "manhajak")
--   - published              → bool default true (CMS published flag; current rows use is_active)
--   - last_edited_by         → uuid FK profiles(id) (audit — matches Phase 1a pattern)
--   - last_edited_at         → timestamptz default now() (audit)
--   - price_eur              → int default 0 (CMS has all-four-currency pricing; DB was missing EUR at the
--                               services level while coach_services has EUR custom pricing already)
--
-- NOTE: existing columns preserved as-is:
--   eligible_kun_levels text[]  (richer than coach_level_min/exact; both kept for transition)
--   coach_control, allows_coach_pricing, min_price_* (operations-side model, unrelated to CMS fields)
--   commission_override_pct, sessions_count, validity_days (already covered)

-- ── services extension ──────────────────────────────────────────────────────
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS bundle_id text,
  ADD COLUMN IF NOT EXISTS discount_percentage integer,
  ADD COLUMN IF NOT EXISTS discount_valid_until date,
  ADD COLUMN IF NOT EXISTS installment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coach_level_min text,
  ADD COLUMN IF NOT EXISTS coach_level_exact text,
  ADD COLUMN IF NOT EXISTS icf_credential_target text,
  ADD COLUMN IF NOT EXISTS coach_slug text,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS student_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS program_slug text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS price_eur integer DEFAULT 0;

-- ── CHECK constraints ──────────────────────────────────────────────────────
-- discount_percentage: 0..100 when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'services_discount_percentage_range'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_discount_percentage_range
      CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100));
  END IF;
END $$;

-- icf_credential_target: one of ACC/PCC/MCC when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'services_icf_credential_target_enum'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_icf_credential_target_enum
      CHECK (icf_credential_target IS NULL OR icf_credential_target IN ('ACC','PCC','MCC'));
  END IF;
END $$;

-- coach_level_min + coach_level_exact: one of the 4 kun levels when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'services_coach_level_min_enum'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_coach_level_min_enum
      CHECK (coach_level_min IS NULL OR coach_level_min IN ('basic','professional','expert','master'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'services_coach_level_exact_enum'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_coach_level_exact_enum
      CHECK (coach_level_exact IS NULL OR coach_level_exact IN ('basic','professional','expert','master'));
  END IF;
END $$;

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS services_published_display_order_idx
  ON services (published, display_order) WHERE published = true;
CREATE INDEX IF NOT EXISTS services_category_idx
  ON services (category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS services_bundle_id_idx
  ON services (bundle_id) WHERE bundle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS services_program_slug_idx
  ON services (program_slug) WHERE program_slug IS NOT NULL;

-- services.slug already exists but may not be unique; enforce uniqueness idempotently.
-- Partial unique index (allows multiple NULL slugs during transition).
CREATE UNIQUE INDEX IF NOT EXISTS services_slug_unique_not_null
  ON services (slug) WHERE slug IS NOT NULL;

-- ── GRANTs ─────────────────────────────────────────────────────────────────
-- services already has privileges from migration 0011; re-granting is a no-op and
-- ensures both roles can read/write the newly-added columns.
GRANT SELECT, INSERT, UPDATE, DELETE ON services TO kunacademy, kunacademy_admin;

-- RLS policies on services are unchanged: migration 0011 + 0012 established
-- public SELECT on is_active + admin full access. The new columns inherit those
-- policies automatically (RLS is row-level, not column-level).
