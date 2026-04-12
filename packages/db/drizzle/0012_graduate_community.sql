-- 0012: Graduate Verification & Community — badge definitions, community members, graduate certificates

-- 1. badge_definitions — static reference table for all badges/credentials issued
CREATE TABLE IF NOT EXISTS badge_definitions (
  slug         text PRIMARY KEY,
  name_ar      text NOT NULL,
  name_en      text NOT NULL,
  description_ar text,
  description_en text,
  image_url    text NOT NULL,
  program_slug text,
  program_url_ar text,
  program_url_en text,
  display_order integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true
);

-- 2. community_members — all graduates/coaches, optionally linked to a profile account
CREATE TABLE IF NOT EXISTS community_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid UNIQUE REFERENCES profiles(id),           -- nullable: null = unclaimed
  student_number text UNIQUE,                                    -- e.g. STCE000001
  slug           text NOT NULL UNIQUE,
  name_ar        text NOT NULL,
  name_en        text NOT NULL,
  email          text,
  phone          text,
  photo_url      text,
  bio_ar         text,
  bio_en         text,
  country        text,
  languages      text[],
  member_type    text NOT NULL DEFAULT 'alumni',                 -- alumni, coach, both
  coaching_status text,                                          -- active, inactive, in_training
  is_visible     boolean NOT NULL DEFAULT true,
  claimed_at     timestamptz,
  source         text NOT NULL DEFAULT 'manual',                 -- sheet_import, crm_import, manual, self_registered
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. graduate_certificates — one row per credential earned by a community member
CREATE TABLE IF NOT EXISTS graduate_certificates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        uuid NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
  program_slug     text NOT NULL,
  program_name_ar  text NOT NULL,
  program_name_en  text NOT NULL,
  certificate_type text NOT NULL,                                -- completion, level_1, level_2, level_3, level_4, specialization, mentorship
  cohort_name      text,
  graduation_date  date NOT NULL,
  icf_credential   text,                                         -- ACC, PCC, MCC
  icf_credential_date date,
  badge_slug       text NOT NULL,
  badge_label_ar   text NOT NULL,
  badge_label_en   text NOT NULL,
  verified         boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, program_slug, certificate_type)            -- prevent duplicate certs
);

-- 4. Indexes on community_members
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_slug
  ON community_members(slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_student_number
  ON community_members(student_number);

-- Partial unique index: enforce email uniqueness only among non-null values
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_email
  ON community_members(email) WHERE email IS NOT NULL;

-- Partial index: fast lookup of members that have claimed an account
CREATE INDEX IF NOT EXISTS idx_community_members_profile_id
  ON community_members(profile_id) WHERE profile_id IS NOT NULL;

-- 5. Indexes on graduate_certificates
CREATE INDEX IF NOT EXISTS idx_graduate_certificates_member_id
  ON graduate_certificates(member_id);

-- 6. CHECK constraints
ALTER TABLE community_members
  ADD CONSTRAINT chk_member_type CHECK (member_type IN ('alumni', 'coach', 'both'));

ALTER TABLE community_members
  ADD CONSTRAINT chk_coaching_status CHECK (
    coaching_status IS NULL OR coaching_status IN ('active', 'inactive', 'in_training')
  );

ALTER TABLE community_members
  ADD CONSTRAINT chk_source CHECK (
    source IN ('sheet_import', 'crm_import', 'manual', 'self_registered')
  );

ALTER TABLE graduate_certificates
  ADD CONSTRAINT chk_certificate_type CHECK (
    certificate_type IN ('completion', 'level_1', 'level_2', 'level_3', 'level_4', 'specialization', 'mentorship')
  );

ALTER TABLE graduate_certificates
  ADD CONSTRAINT chk_icf_credential CHECK (
    icf_credential IS NULL OR icf_credential IN ('ACC', 'PCC', 'MCC')
  );

-- 7. RLS
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE graduate_certificates ENABLE ROW LEVEL SECURITY;

-- Public read on badge_definitions (used in public-facing verification pages)
CREATE POLICY badge_definitions_select ON badge_definitions FOR SELECT USING (true);

-- Public read on visible community members
CREATE POLICY community_members_select ON community_members FOR SELECT USING (is_visible = true);

-- Members can read their own row even if hidden
CREATE POLICY community_members_select_own ON community_members FOR SELECT
  USING (profile_id = auth.uid());

-- Members can update their own row (bio, photo, languages, etc.)
CREATE POLICY community_members_update_own ON community_members FOR UPDATE
  USING (profile_id = auth.uid());

-- Public read on certificates of visible members (powers verification + directory)
CREATE POLICY graduate_certificates_select ON graduate_certificates FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM community_members WHERE is_visible = true
    )
  );

-- Members can read their own certificates regardless of visibility
CREATE POLICY graduate_certificates_select_own ON graduate_certificates FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM community_members WHERE profile_id = auth.uid()
    )
  );
