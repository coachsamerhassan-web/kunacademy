-- Migration 0055 — Wave F.1 — Membership Platform schema + seed
--
-- Adds 6 new tables for the feature-entitlement membership architecture:
--   1. tiers                    — subscription tier config (Free / Paid-1 at launch)
--   2. features                 — extensible feature catalog
--   3. tier_features            — M:N junction (entitlement matrix)
--   4. memberships              — user subscription state (one active row per user)
--   5. pricing_config           — admin-editable misc prices (coach rates, Samer 1:1, etc.)
--   6. pricing_config_audit     — append-only log of pricing changes
--
-- Design notes:
--   - Builds on Canon Seed migration 0053 (programs.member_discount_eligible column).
--   - Stripe Price IDs on tiers are NULL at seed — F.2 (Stripe wiring) populates them.
--   - RLS via app_uid() per `reference_kun_rls_app_uid`.
--   - No SUPERUSER granted per `feedback_never_grant_superuser`.
--   - Partial unique index enforces "ONE non-ended membership per user".
--   - Seed: 2 tiers + 9 features + 13 tier_features rows + 11 pricing_config rows.
--
-- Currency posture (locked F-W1): AED + EGP + EUR multi-currency. Seed has AED
-- as the canonical tier currency; additional currency rows can be added post-ship.
--
-- Locked F-W decisions referenced:
--   F-W3  — single-discount-wins (stackable=false in tier_features.config)
--   F-W4  — STFC + entrepreneurs-6hr NOT member-discount eligible (enforced at
--           programs.member_discount_eligible=false, not here)
--   F-W9  — auto-provision Free on signup (application layer F.5, not migration)
--
-- Idempotent: uses IF NOT EXISTS guards throughout.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. tiers — subscription tier config                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS tiers (
  id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     text         NOT NULL UNIQUE
                                        CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name_ar                  text         NOT NULL,
  name_en                  text         NOT NULL,
  description_ar           text,
  description_en           text,
  price_monthly_cents      integer      NOT NULL DEFAULT 0
                                        CHECK (price_monthly_cents >= 0),
  price_annual_cents       integer      NOT NULL DEFAULT 0
                                        CHECK (price_annual_cents >= 0),
  currency                 text         NOT NULL DEFAULT 'AED'
                                        CHECK (currency IN ('AED','EGP','USD','EUR')),
  stripe_product_id        text,
  stripe_price_id_monthly  text,
  stripe_price_id_annual   text,
  sort_order               integer      NOT NULL DEFAULT 0,
  is_public                boolean      NOT NULL DEFAULT true,
  is_active                boolean      NOT NULL DEFAULT true,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tiers_active_public_idx
  ON tiers (is_active, is_public)
  WHERE is_active = true AND is_public = true;

CREATE INDEX IF NOT EXISTS tiers_sort_order_idx
  ON tiers (sort_order)
  WHERE is_active = true;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. features — feature catalog                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS features (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key      text         NOT NULL UNIQUE
                                CHECK (feature_key ~ '^[a-z0-9][a-z0-9_]*$'
                                       AND char_length(feature_key) <= 40),
  name_ar          text         NOT NULL,
  name_en          text         NOT NULL,
  description_ar   text,
  description_en   text,
  feature_type     text         NOT NULL DEFAULT 'access'
                                CHECK (feature_type IN ('access','action','quota')),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. tier_features — entitlement matrix (M:N)                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS tier_features (
  tier_id      uuid         NOT NULL
                            REFERENCES tiers(id) ON DELETE CASCADE,
  feature_id   uuid         NOT NULL
                            REFERENCES features(id) ON DELETE CASCADE,
  included     boolean      NOT NULL DEFAULT true,
  quota        integer                             -- NULL = unlimited
                            CHECK (quota IS NULL OR quota >= 0),
  config       jsonb,                              -- per-tier feature parameters
  created_at   timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (tier_id, feature_id)
);

CREATE INDEX IF NOT EXISTS tier_features_included_idx
  ON tier_features (tier_id, feature_id)
  WHERE included = true;

CREATE INDEX IF NOT EXISTS tier_features_feature_idx
  ON tier_features (feature_id)
  WHERE included = true;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. memberships — user subscription state                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS memberships (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid         NOT NULL
                                       REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id                 uuid         NOT NULL REFERENCES tiers(id),
  status                  text         NOT NULL DEFAULT 'active'
                                       CHECK (status IN (
                                         'active','past_due','paused',
                                         'cancelled','trialing','expired'
                                       )),
  billing_frequency       text         CHECK (billing_frequency IS NULL
                                              OR billing_frequency IN ('monthly','annual')),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  started_at              timestamptz  NOT NULL DEFAULT now(),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at               timestamptz,
  cancelled_at            timestamptz,
  ended_at                timestamptz,
  metadata                jsonb,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memberships_user_idx
  ON memberships (user_id);

-- Partial unique index — ONE non-ended membership per user
CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_active_uidx
  ON memberships (user_id)
  WHERE ended_at IS NULL
    AND status IN ('active','past_due','paused','trialing');

CREATE INDEX IF NOT EXISTS memberships_tier_status_idx
  ON memberships (tier_id, status)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS memberships_stripe_sub_idx
  ON memberships (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS memberships_cancel_at_idx
  ON memberships (cancel_at)
  WHERE cancel_at IS NOT NULL AND ended_at IS NULL;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. pricing_config — admin-editable misc prices (Q1 surface)              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS pricing_config (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       text         NOT NULL
                                 CHECK (entity_type IN (
                                   'tier','coach_session','samer_session',
                                   'program_discount','early_bird'
                                 )),
  entity_key        text         NOT NULL
                                 CHECK (char_length(entity_key) BETWEEN 1 AND 64),
  value_cents       integer      CHECK (value_cents IS NULL OR value_cents >= 0),
  currency          text         CHECK (currency IS NULL
                                        OR currency IN ('AED','EGP','USD','EUR')),
  updated_by        uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  created_at        timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_key, currency)
);

CREATE INDEX IF NOT EXISTS pricing_config_entity_idx
  ON pricing_config (entity_type);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. pricing_config_audit — append-only audit log                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS pricing_config_audit (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       text         NOT NULL,
  entity_key        text         NOT NULL,
  old_value_cents   integer,
  new_value_cents   integer,
  changed_by        uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at        timestamptz  NOT NULL DEFAULT now(),
  reason            text
);

CREATE INDEX IF NOT EXISTS pricing_config_audit_entity_idx
  ON pricing_config_audit (entity_type, entity_key, changed_at DESC);

CREATE INDEX IF NOT EXISTS pricing_config_audit_changed_by_idx
  ON pricing_config_audit (changed_by, changed_at DESC);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ updated_at triggers (re-use existing set_updated_at function)            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_tiers_updated_at') THEN
    CREATE TRIGGER set_tiers_updated_at BEFORE UPDATE ON tiers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_features_updated_at') THEN
    CREATE TRIGGER set_features_updated_at BEFORE UPDATE ON features
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_memberships_updated_at') THEN
    CREATE TRIGGER set_memberships_updated_at BEFORE UPDATE ON memberships
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Row-Level Security                                                       ║
-- ║   tiers/features/tier_features: public read; admin write                 ║
-- ║   memberships: user reads own (app_uid()); admin all                     ║
-- ║   pricing_config/audit: admin only                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE tiers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE features              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_features         ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config_audit  ENABLE ROW LEVEL SECURITY;

-- ── tiers ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tiers' AND policyname='tiers_public_read') THEN
    CREATE POLICY tiers_public_read ON tiers FOR SELECT
      TO anon, authenticated
      USING (is_active = true AND is_public = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tiers' AND policyname='tiers_admin_all') THEN
    CREATE POLICY tiers_admin_all ON tiers FOR ALL
      TO kunacademy_admin USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── features ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='features' AND policyname='features_public_read') THEN
    CREATE POLICY features_public_read ON features FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='features' AND policyname='features_admin_all') THEN
    CREATE POLICY features_admin_all ON features FOR ALL
      TO kunacademy_admin USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── tier_features ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tier_features' AND policyname='tier_features_public_read') THEN
    CREATE POLICY tier_features_public_read ON tier_features FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (SELECT 1 FROM tiers t WHERE t.id = tier_id AND t.is_active AND t.is_public)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tier_features' AND policyname='tier_features_admin_all') THEN
    CREATE POLICY tier_features_admin_all ON tier_features FOR ALL
      TO kunacademy_admin USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── memberships ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memberships' AND policyname='memberships_owner_read') THEN
    CREATE POLICY memberships_owner_read ON memberships FOR SELECT
      TO authenticated
      USING (user_id = app_uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memberships' AND policyname='memberships_admin_all') THEN
    CREATE POLICY memberships_admin_all ON memberships FOR ALL
      TO kunacademy_admin USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── pricing_config ────────────────────────────────────────────────────────────
-- Admin writes only; server-role (kunacademy) can SELECT for pricing reads
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pricing_config' AND policyname='pricing_config_server_read') THEN
    CREATE POLICY pricing_config_server_read ON pricing_config FOR SELECT
      TO kunacademy
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pricing_config' AND policyname='pricing_config_admin_all') THEN
    CREATE POLICY pricing_config_admin_all ON pricing_config FOR ALL
      TO kunacademy_admin USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── pricing_config_audit ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pricing_config_audit' AND policyname='pricing_config_audit_admin_read') THEN
    CREATE POLICY pricing_config_audit_admin_read ON pricing_config_audit FOR SELECT
      TO kunacademy_admin USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pricing_config_audit' AND policyname='pricing_config_audit_admin_insert') THEN
    CREATE POLICY pricing_config_audit_admin_insert ON pricing_config_audit FOR INSERT
      TO kunacademy_admin WITH CHECK (true);
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ GRANTs (never SUPERUSER; always explicit)                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- kunacademy (app role): read-only on config tables; read own membership via RLS
GRANT SELECT ON tiers, features, tier_features TO kunacademy;
GRANT SELECT ON pricing_config TO kunacademy;
GRANT SELECT, INSERT, UPDATE ON memberships TO kunacademy;

-- kunacademy_admin: full CRUD on all 6 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON tiers                 TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON features              TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON tier_features         TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships           TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON pricing_config        TO kunacademy_admin;
GRANT SELECT, INSERT           ON pricing_config_audit TO kunacademy_admin;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SEED — 2 tiers                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO tiers (slug, name_ar, name_en, description_ar, description_en,
                   price_monthly_cents, price_annual_cents, currency,
                   sort_order, is_public, is_active)
VALUES
  ('free',
   'الباب المفتوح',
   'Free',
   'الوصول إلى مقدّمة التفكير الحسّي ومكتبة القراءة في المجتمع والرسالة الأسبوعية.',
   'Access to the Somatic Thinking introduction, community reading library, and weekly digest.',
   0, 0, 'AED',
   0, true, true),
  ('paid-1',
   'العضوية الأساسية',
   'Paid-1',
   'كل ما في الباب المفتوح، بالإضافة إلى أساسيات الجسد، عمل البوصلة، حقّ الكتابة في المجتمع، جلسة أسئلة شهرية، وخصم 10٪ على البرامج الكبرى.',
   'Everything in Free, plus Body Foundations, Compass Work, community write access, monthly live Q&A, and 10% discount on flagship programs.',
   1500, 15000, 'AED',
   1, true, true)
ON CONFLICT (slug) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SEED — 9 features                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO features (feature_key, name_ar, name_en, description_ar, description_en, feature_type)
VALUES
  ('community_read_only',
   'قراءة المجتمع',
   'Community — Read',
   'الاطلاع على محادثات المجتمع ومشاهدة المنشورات.',
   'Browse community discussions and view posts.',
   'access'),
  ('self_paced_preview',
   'معاينة المحتوى الذاتي',
   'Self-Paced Preview',
   'معاينة مختصرات البرامج الذاتية قبل التسجيل.',
   'Preview short excerpts of self-paced programs before enrolling.',
   'access'),
  ('free_tier_weekly_digest',
   'الرسالة الأسبوعية',
   'Weekly Digest',
   'رسالة بريدية أسبوعية تضمّ أهم ما كتبه سامر وأبرز ما دار في المجتمع.',
   'Weekly email with highlights from Samer and the community.',
   'access'),
  ('somatic_thinking_intro_full',
   'مدخل التفكير الحسّي — الوصول الكامل',
   'Somatic Thinking Intro — Full Access',
   'الوصول الكامل إلى برنامج مدخل التفكير الحسّي.',
   'Full access to the Somatic Thinking introductory program.',
   'access'),
  ('body_foundations_full',
   'أساسيات الجسد — الوصول الكامل',
   'Body Foundations — Full Access',
   'الوصول الكامل إلى برنامج أساسيات الجسد.',
   'Full access to the Body Foundations program.',
   'access'),
  ('compass_work_full',
   'عمل البوصلة — الوصول الكامل',
   'Compass Work — Full Access',
   'الوصول الكامل إلى برنامج عمل البوصلة.',
   'Full access to the Compass Work program.',
   'access'),
  ('community_post_write',
   'كتابة في المجتمع',
   'Community — Post',
   'حقّ نشر منشورات وردود في محادثات المجتمع.',
   'Post and reply in community discussions.',
   'action'),
  ('live_qa_monthly',
   'جلسة أسئلة شهرية مباشرة',
   'Monthly Live Q&A',
   'جلسة شهرية مباشرة مع سامر للأعضاء.',
   'Monthly live Q&A session with Samer for members.',
   'access'),
  ('program_member_discount_10pct',
   'خصم الأعضاء — 10٪',
   'Member Discount — 10%',
   'خصم 10٪ على البرامج الكبرى المؤهّلة (جي بي إس، إحياء، وِصال، بذور).',
   '10% discount on eligible flagship programs (GPS, Ihya, Wisal, Seeds).',
   'action')
ON CONFLICT (feature_key) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SEED — tier_features entitlement matrix                                  ║
-- ║                                                                          ║
-- ║   Free  gets: read, self-paced-preview, weekly-digest, ST-intro          ║
-- ║   Paid-1 gets: ALL Free + body-foundations + compass-work +              ║
-- ║                community-write + monthly-Q&A + 10% discount              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Free tier × 4 features
INSERT INTO tier_features (tier_id, feature_id, included, quota, config)
SELECT t.id, f.id, true, NULL::int, NULL::jsonb
FROM tiers t, features f
WHERE t.slug = 'free'
  AND f.feature_key IN (
    'community_read_only',
    'self_paced_preview',
    'free_tier_weekly_digest',
    'somatic_thinking_intro_full'
  )
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- Paid-1 tier × 8 features (4 inherited from Free + 4 exclusive + discount)
-- Inherited (so Paid-1 members don't lose Free-tier access):
INSERT INTO tier_features (tier_id, feature_id, included, quota, config)
SELECT t.id, f.id, true, NULL::int, NULL::jsonb
FROM tiers t, features f
WHERE t.slug = 'paid-1'
  AND f.feature_key IN (
    'community_read_only',
    'self_paced_preview',
    'free_tier_weekly_digest',
    'somatic_thinking_intro_full',
    'body_foundations_full',
    'compass_work_full',
    'community_post_write',
    'live_qa_monthly'
  )
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- Paid-1 × program_member_discount_10pct (with config per F-W3 single-discount-wins)
INSERT INTO tier_features (tier_id, feature_id, included, quota, config)
SELECT t.id, f.id, true, NULL::int,
       jsonb_build_object(
         'discount_percentage', 10,
         'stackable', false,
         'eligible_program_source', 'programs.member_discount_eligible=true'
       )
FROM tiers t, features f
WHERE t.slug = 'paid-1' AND f.feature_key = 'program_member_discount_10pct'
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SEED — pricing_config                                                    ║
-- ║                                                                          ║
-- ║   coach_session: level 1-4 hourly rates (AED)                            ║
-- ║   samer_session: per-session + 6-pack (AED)                              ║
-- ║   program_discount: member discount percentage                           ║
-- ║   early_bird: early-bird discount percentage                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO pricing_config (entity_type, entity_key, value_cents, currency)
VALUES
  -- Coach session rates per tier (AED per session, hourly)
  -- Associate = 250, Professional = 400, Master = 600, Expert = 800
  ('coach_session',   'associate',        25000, 'AED'),
  ('coach_session',   'professional',     40000, 'AED'),
  ('coach_session',   'master',           60000, 'AED'),
  ('coach_session',   'expert',           80000, 'AED'),

  -- Samer 1:1 rates (AED)
  ('samer_session',   'single_session',  200000, 'AED'),
  ('samer_session',   'six_pack',       1100000, 'AED'),

  -- Program member discount percentage (stored as basis points × 100 for precision;
  -- value_cents=1000 = 10.00% — value_cents is the integer percent × 100)
  ('program_discount','member_discount_pct',        1000, NULL),

  -- Early-bird discount percentage (15.00%)
  ('early_bird',      'early_bird_discount_pct',    1500, NULL),

  -- Tier canonical values mirrored for dashboard unification (reads from tiers too)
  ('tier',            'paid-1_monthly',   1500, 'AED'),
  ('tier',            'paid-1_annual',   15000, 'AED'),
  ('tier',            'free_monthly',        0, 'AED')
ON CONFLICT (entity_type, entity_key, currency) DO NOTHING;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Post-migration integrity checks (run manually via psql after apply)      ║
-- ║                                                                          ║
-- ║   SELECT count(*) FROM tiers;                           -- expect 2      ║
-- ║   SELECT count(*) FROM features;                        -- expect 9      ║
-- ║   SELECT count(*) FROM tier_features;                   -- expect 13     ║
-- ║   SELECT count(*) FROM pricing_config;                  -- expect 11     ║
-- ║   SELECT count(*) FROM memberships;                     -- expect 0      ║
-- ║   SELECT count(*) FROM pricing_config_audit;            -- expect 0      ║
-- ║                                                                          ║
-- ║   SELECT count(*) FROM pg_policies                                       ║
-- ║     WHERE tablename IN ('tiers','features','tier_features',              ║
-- ║                         'memberships','pricing_config',                  ║
-- ║                         'pricing_config_audit');        -- expect 12     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
