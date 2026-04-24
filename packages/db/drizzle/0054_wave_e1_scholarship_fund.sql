-- Migration 0054: Wave E.1 — Scholarship Fund schema (donations + applications + scholarships + junction)
--
-- Source authority:
--   /Users/samer/Claude Code/Project Memory/KUN-Features/WAVE-E-SCHOLARSHIP-FUND-SPEC.md §5
--   B1-B5 decisions resolved 2026-04-24 (Samer GO E BUILD)
--   Amin's accounting pre-work: /Users/samer/Claude Code/Workspace/CFO/output/2026-04-24-canon-phase2-zoho-dryrun.md §scholarship-fund
--
-- Scope (E.1 only — additive, no data migration):
--   (1) donations                    — donor ledger + Stripe link + designation preference
--   (2) scholarship_applications     — applicant intake + screening state machine
--   (3) scholarships                 — allocated awards (joins applications + donations)
--   (4) scholarship_donation_links   — many-to-many junction (one scholarship can be
--                                       funded by multiple donations; tracks per-donation
--                                       amount_portion for partial allocations)
--   (5) RLS policies via app_uid() / is_admin() per platform pattern
--   (6) Explicit GRANTs to kunacademy (app) + kunacademy_admin (BYPASSRLS)
--   (7) Indexes for expected query shapes
--
-- Feature flag (B2):
--   SCHOLARSHIP_PUBLIC_LAUNCH env var — read at application layer in E.3. Not gated at DB.
--   Default in env: false. Schema ships now; public launch gated on UAE CT advisory
--   (spec §13.3) + Samer's formal flip after E.6 four-role acceptance.
--
-- IP / dignity boundary (per CLAUDE.md line 42 + spec §3):
--   No program session counts / beat sequences in any column default / comment.
--   No banned words ("free"/"مجاني", "charity"/"صدقة", "entry-level", "discount" for
--   sponsored path). Enforcement happens at application layer (grep-audit at commit
--   per spec §3.2) — schema is structurally neutral.
--
-- RLS posture:
--   Public writes allowed via API layer with CAPTCHA + rate limit; DB RLS applies
--   admin-read-all + self-read for donors (by email match) + applicants (by user_id
--   or email match).
--   Anonymous donations: name + email ARE stored; is_anonymous=true controls
--   display on transparency dashboard ONLY (DB does not scrub). Spec §4.1 step 8.
--   Recipient PII: scholarship_donation_links is admin-only (no recipient or donor
--   self-read) so the donor↔recipient pairing surface cannot be queried by either
--   party. Dignity framing per spec §9.3 applies.
--
-- Idempotency:
--   CREATE TABLE IF NOT EXISTS — re-run safe
--   DROP POLICY IF EXISTS before each CREATE POLICY — re-run safe
--   GRANTs are idempotent in Postgres
--
-- Rollback: see manual ROLLBACK block at the foot of this file.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- (1) donations
--     Donor-facing ledger. One row per discrete donation event.
--     For recurring (Stripe Subscription) — one row per monthly charge,
--     sharing stripe_subscription_id across rows.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS donations (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Donor identity (name + email always stored; display gated by is_anonymous)
  donor_name                 TEXT NOT NULL,
  donor_email                TEXT NOT NULL,
  donor_message              TEXT, -- optional, app-capped at 280 chars

  -- Amount in minor units per platform convention (e.g., 1000 = AED 10.00)
  amount_cents               INTEGER NOT NULL CHECK (amount_cents > 0),
  currency                   TEXT NOT NULL,

  -- Stripe identifiers
  stripe_payment_intent_id   TEXT UNIQUE, -- one-time donations; unique per PI
  stripe_subscription_id     TEXT,        -- recurring donations; shared across monthly rows
  stripe_customer_id         TEXT,

  -- Designation preference (not hard-pin; admin may re-assign per spec §4.1.5)
  designation_preference     TEXT NOT NULL DEFAULT 'any',

  -- Flags
  is_anonymous               BOOLEAN NOT NULL DEFAULT FALSE,
  is_recurring               BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status lifecycle
  status                     TEXT NOT NULL DEFAULT 'received',

  -- Allocation linkage (nullable until allocated; FK added at end of migration
  -- to break circular dependency with scholarships table).
  allocated_to_scholarship_id UUID,

  -- Zoho Books Projects linkage (for Amin reconciliation — spec §8.5)
  zoho_project_task_id       TEXT,

  -- Timestamps
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_at               TIMESTAMPTZ,
  refunded_at                TIMESTAMPTZ,

  -- Metadata envelope (source tracking per B5, locale, utm, IP, etc.)
  -- source keys used:
  --   'stripe_webhook'  → donation came in via Stripe webhook event
  --   'manual_entry'    → donation entered by admin UI (corporate cheque, bank transfer,
  --                        legacy import) per B5. UI must set metadata.source='manual_entry'.
  metadata                   JSONB NOT NULL DEFAULT '{}',

  -- Enum CHECKs (broad; can widen via follow-up migration per codebase pattern)
  CONSTRAINT donations_currency_check
    CHECK (currency IN ('AED','USD','EUR','SAR','EGP','GBP')),
  CONSTRAINT donations_designation_check
    CHECK (designation_preference IN ('gps','ihya','wisal','seeds','any')),
  CONSTRAINT donations_status_check
    CHECK (status IN ('received','allocated','disbursed','refunded','failed'))
);

CREATE INDEX IF NOT EXISTS idx_donations_status          ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_designation     ON donations(designation_preference) WHERE status = 'received';
CREATE INDEX IF NOT EXISTS idx_donations_email           ON donations(lower(donor_email));
CREATE INDEX IF NOT EXISTS idx_donations_subscription    ON donations(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_created_at      ON donations(created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════
-- (2) scholarship_applications
--     Applicant intake + screening state machine.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scholarship_applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Applicant identity — user_id nullable (public submit allowed w/o account)
  user_id               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  applicant_name        TEXT NOT NULL,
  applicant_email       TEXT NOT NULL,
  applicant_phone       TEXT,
  preferred_language    TEXT NOT NULL DEFAULT 'ar',

  -- Program requested
  program_family        TEXT NOT NULL,
  program_slug          TEXT NOT NULL,
  scholarship_tier      TEXT NOT NULL,

  -- Application content (open-text screening fields per spec §4.3 step 5)
  application_json      JSONB NOT NULL DEFAULT '{}',

  -- Screening state machine (spec §5.3)
  status                TEXT NOT NULL DEFAULT 'pending',

  -- Review metadata
  screened_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  screened_at           TIMESTAMPTZ,
  rejection_reason      TEXT, -- internal only, never shown to applicant

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata              JSONB NOT NULL DEFAULT '{}',

  -- Enum CHECKs
  CONSTRAINT scholarship_applications_lang_check
    CHECK (preferred_language IN ('ar','en')),
  CONSTRAINT scholarship_applications_family_check
    CHECK (program_family IN ('gps','ihya','wisal','seeds')),
  CONSTRAINT scholarship_applications_tier_check
    CHECK (scholarship_tier IN ('partial','full')),
  CONSTRAINT scholarship_applications_status_check
    CHECK (status IN ('pending','in_review','info_requested','approved','allocated','disbursed','rejected','withdrawn'))
);

CREATE INDEX IF NOT EXISTS idx_scholarship_apps_status     ON scholarship_applications(status);
CREATE INDEX IF NOT EXISTS idx_scholarship_apps_family     ON scholarship_applications(program_family);
CREATE INDEX IF NOT EXISTS idx_scholarship_apps_user       ON scholarship_applications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scholarship_apps_email      ON scholarship_applications(lower(applicant_email));
CREATE INDEX IF NOT EXISTS idx_scholarship_apps_created_at ON scholarship_applications(created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════
-- (3) scholarships
--     Allocated awards — the actual scholarship instance. Joined to one
--     application (1:1) and one-or-more donations (via junction table).
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scholarships (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Forward references
  application_id             UUID NOT NULL REFERENCES scholarship_applications(id) ON DELETE RESTRICT,

  -- Denormalized snapshot (for reporting speed + in case application is withdrawn)
  recipient_name             TEXT NOT NULL,
  recipient_email            TEXT NOT NULL,
  program_family             TEXT NOT NULL,
  program_slug               TEXT NOT NULL,
  scholarship_tier           TEXT NOT NULL,

  -- Funding amount
  amount_cents               INTEGER NOT NULL CHECK (amount_cents > 0),
  currency                   TEXT NOT NULL,

  -- Program enrollment linkage (populated at disburse step)
  program_enrollment_id      UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  disbursed_at               TIMESTAMPTZ,

  -- Admin attribution
  allocated_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  allocated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Zoho Books Projects linkage (spec §8.2)
  zoho_allocation_task_id    TEXT,
  zoho_disbursement_task_id  TEXT,

  -- Admin notes (internal only)
  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                   JSONB NOT NULL DEFAULT '{}',

  -- Enum CHECKs
  CONSTRAINT scholarships_family_check
    CHECK (program_family IN ('gps','ihya','wisal','seeds')),
  CONSTRAINT scholarships_tier_check
    CHECK (scholarship_tier IN ('partial','full')),
  CONSTRAINT scholarships_currency_check
    CHECK (currency IN ('AED','USD','EUR','SAR','EGP','GBP'))
);

CREATE INDEX IF NOT EXISTS idx_scholarships_app          ON scholarships(application_id);
CREATE INDEX IF NOT EXISTS idx_scholarships_family       ON scholarships(program_family);
CREATE INDEX IF NOT EXISTS idx_scholarships_disbursed    ON scholarships(disbursed_at) WHERE disbursed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scholarships_recipient    ON scholarships(lower(recipient_email));

-- Now add the deferred FK on donations.allocated_to_scholarship_id
ALTER TABLE donations
  DROP CONSTRAINT IF EXISTS donations_allocated_scholarship_fkey;
ALTER TABLE donations
  ADD CONSTRAINT donations_allocated_scholarship_fkey
  FOREIGN KEY (allocated_to_scholarship_id) REFERENCES scholarships(id) ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════════════════════
-- (4) scholarship_donation_links — junction (many-to-many)
--     One scholarship may be funded by multiple donations.
--     amount_portion tracked per-donation in DONATION's native currency minor
--     units (so multi-currency funding is preserved for audit).
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scholarship_donation_links (
  scholarship_id    UUID NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  donation_id       UUID NOT NULL REFERENCES donations(id) ON DELETE RESTRICT,
  amount_portion    INTEGER NOT NULL CHECK (amount_portion > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scholarship_id, donation_id)
);

CREATE INDEX IF NOT EXISTS idx_sdl_donation ON scholarship_donation_links(donation_id);

-- ══════════════════════════════════════════════════════════════════════════
-- (5) RLS policies — using app_uid() + is_admin() per platform pattern
--     (reference_kun_rls_app_uid + codebase-2026-04-22 is_admin helper)
-- ══════════════════════════════════════════════════════════════════════════

-- donations RLS
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Drop-then-create so migration re-runs cleanly
DROP POLICY IF EXISTS donations_admin_all        ON donations;
DROP POLICY IF EXISTS donations_donor_self_read  ON donations;

-- Admin full access (read, insert, update, delete)
CREATE POLICY donations_admin_all ON donations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Donor self-read by email match (authenticated users only; anonymous donors
-- have no logged-in identity to correlate and therefore cannot self-read).
-- Case-insensitive: lower(donor_email) vs lower(profiles.email).
CREATE POLICY donations_donor_self_read ON donations
  FOR SELECT TO authenticated
  USING (
    lower(donor_email) = (SELECT lower(email) FROM profiles WHERE id = app_uid())
  );

-- scholarship_applications RLS
ALTER TABLE scholarship_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apps_admin_all            ON scholarship_applications;
DROP POLICY IF EXISTS apps_applicant_self_read  ON scholarship_applications;

-- Admin full access
CREATE POLICY apps_admin_all ON scholarship_applications
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Applicant self-read (by user_id OR email match for pre-account applicants who
-- later create an account with the same email)
CREATE POLICY apps_applicant_self_read ON scholarship_applications
  FOR SELECT TO authenticated
  USING (
    user_id = app_uid()
    OR lower(applicant_email) = (SELECT lower(email) FROM profiles WHERE id = app_uid())
  );

-- Coach read policy (DEFERRED to post-E.1):
--   The dispatch asks for "coaches read applications for programs they teach"
--   but the `instructors` table has no `programs_taught` column today — the
--   coach↔program mapping lives implicitly in courses.instructor_id + lesson
--   assignments, not in a flat array on instructors. Implementing that join
--   inside an RLS policy has nontrivial performance implications and should
--   come alongside Hakima's parallel `access_pathways` work (spec §13.5).
--   For E.1, admin + applicant self-read is sufficient — coaches do not need
--   to read pending applications before allocation happens in E.6.
--   Policy intentionally omitted. Add via follow-up migration when the
--   program-instructor mapping is canonical.

-- scholarships RLS
ALTER TABLE scholarships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scholarships_admin_all       ON scholarships;
DROP POLICY IF EXISTS scholarships_recipient_read  ON scholarships;

CREATE POLICY scholarships_admin_all ON scholarships
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Recipient self-read by email match (to show their own scholarship status in a
-- future member dashboard). No donor-view — donor↔recipient pairing is admin-only.
CREATE POLICY scholarships_recipient_read ON scholarships
  FOR SELECT TO authenticated
  USING (
    lower(recipient_email) = (SELECT lower(email) FROM profiles WHERE id = app_uid())
  );

-- scholarship_donation_links RLS — ADMIN ONLY
-- This table links a donor to a recipient. No self-read at all — dignity framing
-- (spec §9.3): donors should not see which specific recipient they funded, and
-- recipients should not see which specific donor funded them. Admin-only.
ALTER TABLE scholarship_donation_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sdl_admin_all ON scholarship_donation_links;

CREATE POLICY sdl_admin_all ON scholarship_donation_links
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ══════════════════════════════════════════════════════════════════════════
-- (6) GRANTs (per reference_kunacademy_db_role_model — never SUPERUSER)
--     kunacademy       = app role (with RLS)
--     kunacademy_admin = admin role (BYPASSRLS — already has full access by
--                        role property; GRANT is formally still required for
--                        table-level privilege enumeration to work).
-- ══════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON donations                  TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON scholarship_applications   TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON scholarships               TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON scholarship_donation_links TO kunacademy;

GRANT SELECT, INSERT, UPDATE, DELETE ON donations                  TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON scholarship_applications   TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON scholarships               TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON scholarship_donation_links TO kunacademy_admin;

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, not auto-executed)
-- ══════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   -- Drop junction first (FK on both sides)
--   DROP TABLE IF EXISTS scholarship_donation_links;
--   -- donations.allocated_to_scholarship_id FK must go before scholarships table
--   ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_allocated_scholarship_fkey;
--   DROP TABLE IF EXISTS scholarships;
--   DROP TABLE IF EXISTS scholarship_applications;
--   DROP TABLE IF EXISTS donations;
--   -- Tracking row cleanup (optional — drizzle-kit skip-check uses timestamp)
--   -- DELETE FROM drizzle.__drizzle_migrations WHERE hash IN (
--   --   SELECT encode(sha256(file_contents::bytea),'hex')
--   --   FROM (VALUES (pg_read_file('…/0054_wave_e1_scholarship_fund.sql'))) AS t(file_contents)
--   -- );
-- COMMIT;
