-- Migration 0032: CMS→DB Phase 2b — instructors / TeamMember extension
--
-- Extends existing `instructors` table to cover remaining CMS TeamMember fields.
-- Mirrors the Phase 2a pattern (migration 0031): ADD COLUMN IF NOT EXISTS, idempotent,
-- explicit GRANTs preserved, RLS untouched (instructors already has public-is_visible
-- SELECT and admin ALL policies established in earlier migrations + hardened in
-- supabase/migrations/20260414120000_instructors_rls_hardening.sql).
--
-- BRIDGE (public coach-profile ratings): `profile_id` FK already exists and is
-- nullable. This migration re-declares it with ON DELETE SET NULL so a profile
-- deletion does not cascade through to the public coach card. DbContentProvider
-- gains getInstructorByProfileId to complete the bridge.
--
-- Mapping from plan (CMS-TO-DB-MIGRATION-PLAN.md §TeamMember) to columns:
--   - name_ar / name_en    → name_ar, name_en (CMS TeamMember display name)
--   - bio_doc_id           → bio_doc_id text (Google Doc ID for rich bio)
--   - coach_level (legacy) → coach_level_legacy text (raw CMS column; preserved
--                               for audit during transition — both icf_credential
--                               and kun_level already exist in DB)
--   - languages            → languages text[] (CMS csv → pg array)
--   - is_bookable          → is_bookable boolean default true
--   - published            → published boolean default true (CMS published flag;
--                               is_visible kept for public listing, published
--                               for draft/editorial toggle mirror of Phase 2a)
--   - last_edited_by       → uuid FK profiles(id) (audit — Phase 1a pattern)
--   - last_edited_at       → timestamptz default now() (audit)
--
-- NOTE: existing columns preserved as-is:
--   slug, title_ar, title_en, bio_ar, bio_en, photo_url, credentials, kun_level,
--   icf_credential, service_roles[], specialties[], coaching_styles[],
--   development_types[], pricing_json, is_visible, is_platform_coach,
--   display_order, profile_id.
--
-- NOTE: the RLS hardening migration (2026-04-14) already referenced a
--   coach_level_legacy_do_not_use column in comments. We name the new column
--   `coach_level_legacy` to match the CMS source without implying the older
--   sentinel. If the older column exists it stays — idempotent ADD.

-- ── instructors extension ────────────────────────────────────────────────────
ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS name_ar            text,
  ADD COLUMN IF NOT EXISTS name_en            text,
  ADD COLUMN IF NOT EXISTS bio_doc_id         text,
  ADD COLUMN IF NOT EXISTS coach_level_legacy text,
  ADD COLUMN IF NOT EXISTS languages          text[],
  ADD COLUMN IF NOT EXISTS is_bookable        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS published          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_edited_by     uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS last_edited_at     timestamptz NOT NULL DEFAULT now();

-- ── profile_id FK hardening — ON DELETE SET NULL ─────────────────────────────
-- Drop the pre-existing FK (if any) and re-add with ON DELETE SET NULL so
-- public coach profile pages degrade gracefully when the owning profile is
-- deleted (rating aggregates stay on the instructor row, link becomes dead).
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'instructors'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'instructors'::regclass AND attname = 'profile_id'
    )]::smallint[]
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE instructors DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE instructors
  ADD CONSTRAINT instructors_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── CHECK constraints ────────────────────────────────────────────────────────
-- icf_credential: ACC/PCC/MCC when set (column pre-exists; enforce shape now
-- that we surface it via admin UI).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'instructors_icf_credential_enum'
  ) THEN
    ALTER TABLE instructors ADD CONSTRAINT instructors_icf_credential_enum
      CHECK (icf_credential IS NULL OR icf_credential IN ('ACC','PCC','MCC'));
  END IF;
END $$;

-- kun_level: one of the 4 enum values when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'instructors_kun_level_enum'
  ) THEN
    ALTER TABLE instructors ADD CONSTRAINT instructors_kun_level_enum
      CHECK (kun_level IS NULL OR kun_level IN ('basic','professional','expert','master'));
  END IF;
END $$;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS instructors_published_display_order_idx
  ON instructors (published, display_order) WHERE published = true;
CREATE INDEX IF NOT EXISTS instructors_profile_id_idx
  ON instructors (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS instructors_is_bookable_idx
  ON instructors (is_bookable) WHERE is_bookable = true;

-- instructors.slug: partial unique (allows multiple NULL slugs during transition)
CREATE UNIQUE INDEX IF NOT EXISTS instructors_slug_unique_not_null
  ON instructors (slug) WHERE slug IS NOT NULL;

-- ── GRANTs ───────────────────────────────────────────────────────────────────
-- App role + admin role need full read/write on the new columns.
-- (Column-level grants in the 2026-04-14 hardening migration pin authenticated
-- to a safe allowlist; new columns are NOT added to that allowlist — admin-only.)
GRANT SELECT, INSERT, UPDATE, DELETE ON instructors TO kunacademy, kunacademy_admin;

-- Public anon SELECT is already covered by RLS (`Public can read visible
-- instructors`). New columns inherit that policy.
-- Surface name_ar / name_en / languages / is_bookable / published for anon too,
-- since the public coach card needs them.
GRANT SELECT (
  id,
  profile_id,
  slug,
  title_ar,
  title_en,
  name_ar,
  name_en,
  bio_ar,
  bio_en,
  bio_doc_id,
  photo_url,
  credentials,
  kun_level,
  icf_credential,
  service_roles,
  specialties,
  coaching_styles,
  development_types,
  languages,
  pricing_json,
  is_visible,
  is_bookable,
  is_platform_coach,
  published,
  display_order
) ON instructors TO anon, authenticated;

-- RLS policies on instructors are unchanged: public SELECT when is_visible=true,
-- admin ALL. The new columns inherit those policies automatically.
