-- Migration 0065 — Wave 15 Wave 1 — static_pages table (sibling of landing_pages)
--
-- Source authority:
--   /Users/samer/Claude Code/Project Memory/KUN-Features/Specs/wave-15-unified-content-system-CONSOLIDATED.md §4.1
--   Wave 15 Wave 1 dispatch (2026-04-27)
--
-- Scope:
--   (1) static_pages — new table modeled on landing_pages JSONB shape; serves
--       editorial kinds 'static' (default), 'program_detail', 'methodology_essay',
--       'portal_page' (per consolidated spec §2.2).
--   (2) Status state machine column (draft / review / published / archived) +
--       scheduled_publish_at + published BOOLEAN sync (the boolean stays in sync
--       with status='published' for backwards-compat read paths via the trigger
--       on landing_pages/blog_posts in migration 0066).
--   (3) RLS modeled on landing_pages.published_read + admin_all (per spec §4.1).
--       Lifted from migration 0035 + tightened.
--   (4) Append-only authorship audit columns: created_by_kind / created_by_id,
--       last_edited_by_kind / last_edited_by_id / last_edited_by_name. The kind
--       columns ('human' / 'agent' / 'system') discriminate authorship for the
--       Wave 15 agent-write boundary.
--   (5) Indexes on slug (UNIQUE), status, published_at DESC NULLS LAST,
--       scheduled_publish_at WHERE NOT NULL, kind.
--   (6) Postgres table-owner RLS exemption pattern: ALTER TABLE … OWNER TO
--       postgres after psql -f apply (per overnight 2026-04-26 learning).
--
-- IP / dignity boundary (per CLAUDE.md):
--   This migration is purely structural — no methodology copy stored, no
--   IP-classified text written. All copy that lands in composition_json /
--   hero_json passes through Wave 2's pre-publish lint surface (R1-R13)
--   before transition_published.
--
-- Idempotency:
--   CREATE TABLE IF NOT EXISTS — re-run safe.
--   DROP POLICY IF EXISTS before each CREATE POLICY — re-run safe.
--   CHECK constraints guarded by EXISTS in pg_constraint.
--   GRANTs are idempotent in Postgres.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. static_pages — sibling of landing_pages for non-LP authored content   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS static_pages (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     text NOT NULL UNIQUE,

  -- Editorial kind (Hakima §1) — discriminator for the same row shape.
  kind                     text NOT NULL DEFAULT 'static',

  -- Body composition (matches landing_pages.composition_json shape — same
  -- LpComposition TS type). Default empty object so partial drafts render
  -- gracefully via lp-renderer fallback.
  composition_json         jsonb DEFAULT '{}'::jsonb,

  -- Hero/CTA bundle (matches landing_pages.hero_json shape).
  hero_json                jsonb DEFAULT '{}'::jsonb,

  -- SEO bundle (matches landing_pages.seo_meta_json shape).
  seo_meta_json            jsonb DEFAULT '{}'::jsonb,

  -- Status state machine (Wave 15 §4.1).
  status                   text NOT NULL DEFAULT 'draft',

  -- Scheduled publish (cron flips status='review' && scheduled_publish_at <= now()
  -- to 'published' per D13). NULL = not scheduled.
  scheduled_publish_at     timestamptz,

  -- Backwards-compat boolean. Kept in sync with status='published' via trigger
  -- on landing_pages/blog_posts (migration 0066). For static_pages, callers
  -- are net-new so they query status directly — but the boolean stays for
  -- reader symmetry and future shared-read helpers.
  published                boolean NOT NULL DEFAULT false,
  published_at             timestamptz,

  -- Launch isolation parity with landing_pages.launch_lock (Wave 14).
  -- When LAUNCH_MODE=landing-only, static pages with launch_lock=true are
  -- reachable; default false honors pre-launch isolation.
  launch_lock              boolean NOT NULL DEFAULT false,

  -- Authorship audit (Wave 15 §1.5 + §4.1).
  -- created_by_kind ∈ {'human','agent','system'}
  created_by_kind          text NOT NULL,
  created_by_id            uuid,                                 -- profiles.id OR agent_tokens.id
  last_edited_by_kind      text NOT NULL,
  last_edited_by_id        uuid,
  last_edited_by_name      text,                                 -- denormalized for audit display
  last_edited_at           timestamptz NOT NULL DEFAULT now(),

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE static_pages IS
  'Wave 15 Wave 1 — sibling of landing_pages for editorial kinds: static, '
  'program_detail, methodology_essay, portal_page. Same JSONB composition '
  'shape; same renderer surface; different routing + lint scope. Per spec '
  '§2.1 sibling-tables architecture (no unification rewrite of landing_pages).';

COMMENT ON COLUMN static_pages.kind IS
  'Editorial kind discriminator: static (default for /about, /contact, /faq, '
  '/team), program_detail (author-able body for /programs/[slug]), '
  'methodology_essay (Hakima IP-sensitive lane), portal_page (member-area '
  'static content). One table, multiple kinds — keeps schema flat.';

COMMENT ON COLUMN static_pages.status IS
  'Status state machine: draft → review → published; review can return to '
  'draft; published can transition to archived; archived cannot return to '
  'review (Wave 15 §4.1, D8). Agent writes ALWAYS land in draft (no agent '
  'has direct publish authority except Shahira on testimonials per D8).';

COMMENT ON COLUMN static_pages.created_by_kind IS
  'Authorship discriminator for created_by_id: human → profiles.id, agent → '
  'agent_tokens.id, system → NULL (migration / cron / seeder).';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. CHECK constraints                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- kind ∈ {'static','program_detail','methodology_essay','portal_page'}
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'static_pages'::regclass
      AND conname  = 'static_pages_kind_chk'
  ) THEN
    ALTER TABLE static_pages
      ADD CONSTRAINT static_pages_kind_chk
      CHECK (kind IN ('static','program_detail','methodology_essay','portal_page'));
  END IF;
END $$;

-- status ∈ {'draft','review','published','archived'}
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'static_pages'::regclass
      AND conname  = 'static_pages_status_chk'
  ) THEN
    ALTER TABLE static_pages
      ADD CONSTRAINT static_pages_status_chk
      CHECK (status IN ('draft','review','published','archived'));
  END IF;
END $$;

-- created_by_kind ∈ {'human','agent','system'}
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'static_pages'::regclass
      AND conname  = 'static_pages_created_by_kind_chk'
  ) THEN
    ALTER TABLE static_pages
      ADD CONSTRAINT static_pages_created_by_kind_chk
      CHECK (created_by_kind IN ('human','agent','system'));
  END IF;
END $$;

-- last_edited_by_kind ∈ {'human','agent','system'}
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'static_pages'::regclass
      AND conname  = 'static_pages_last_edited_by_kind_chk'
  ) THEN
    ALTER TABLE static_pages
      ADD CONSTRAINT static_pages_last_edited_by_kind_chk
      CHECK (last_edited_by_kind IN ('human','agent','system'));
  END IF;
END $$;

-- published & published_at coherence: when status='published', published=true
-- and published_at IS NOT NULL. This is enforced via a trigger (sync trigger
-- in section 5) rather than a CHECK because CHECK on multiple columns runs
-- BEFORE the trigger, blocking valid updates mid-transition.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Indexes                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- slug is already UNIQUE (declared above) which builds an implicit index;
-- the named slug index mirrors landing_pages_slug_idx so future query plans
-- and admin tooling that grep on table_idx names find both. Storage cost is
-- negligible (one btree per slug, no duplicate column data). Acknowledged
-- DeepSeek-light Wave 15 W1 LOW finding (intentionally retained for symmetry
-- with landing_pages convention).
CREATE INDEX IF NOT EXISTS static_pages_slug_idx          ON static_pages (slug);
CREATE INDEX IF NOT EXISTS static_pages_status_idx        ON static_pages (status);
CREATE INDEX IF NOT EXISTS static_pages_kind_idx          ON static_pages (kind);
CREATE INDEX IF NOT EXISTS static_pages_published_at_idx  ON static_pages (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS static_pages_scheduled_idx     ON static_pages (scheduled_publish_at)
  WHERE scheduled_publish_at IS NOT NULL;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. RLS — modeled on landing_pages (migration 0035)                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE static_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS static_pages_public_read   ON static_pages;
DROP POLICY IF EXISTS static_pages_admin_all     ON static_pages;
DROP POLICY IF EXISTS static_pages_anon_block    ON static_pages;

-- Public read: only when status='published'. Anon and authenticated readers
-- both see published rows; drafts/review/archived are admin-only.
CREATE POLICY static_pages_public_read ON static_pages
  FOR SELECT
  USING (status = 'published');

-- Admin full access (kunacademy_admin role bypasses RLS via withAdminContext;
-- this policy preserves admin reach when accessed through the kunacademy app
-- role with is_admin()=true claim).
CREATE POLICY static_pages_admin_all ON static_pages
  FOR ALL
  TO kunacademy_admin
  USING (true)
  WITH CHECK (true);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Sync trigger — keep `published BOOLEAN` in lockstep with `status`     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Backwards-compat readers query `WHERE published=true`; the spec mandates
-- they keep working. This trigger sets:
--   status = 'published'  ⇒ published=true,  published_at = COALESCE(NEW.published_at, now())
--   status != 'published' ⇒ published=false, published_at = NULL
-- on INSERT or UPDATE of status.

CREATE OR REPLACE FUNCTION static_pages_sync_published_boolean()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' THEN
    NEW.published    := true;
    NEW.published_at := COALESCE(NEW.published_at, now());
  ELSE
    NEW.published    := false;
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS static_pages_sync_published_boolean_trg ON static_pages;
CREATE TRIGGER static_pages_sync_published_boolean_trg
  BEFORE INSERT OR UPDATE OF status ON static_pages
  FOR EACH ROW
  EXECUTE FUNCTION static_pages_sync_published_boolean();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. updated_at touch trigger — per-table convention (per learned-pattern  ║
-- ║    2026-04-24: kunacademy DB has no generic set_updated_at() function;   ║
-- ║    every table defines its own).                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION static_pages_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at     := now();
  NEW.last_edited_at := COALESCE(NEW.last_edited_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS static_pages_touch_updated_at ON static_pages;
CREATE TRIGGER static_pages_touch_updated_at
  BEFORE UPDATE ON static_pages
  FOR EACH ROW
  EXECUTE FUNCTION static_pages_touch_updated_at();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. GRANTs — kunacademy app role + kunacademy_admin                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

GRANT SELECT, INSERT, UPDATE, DELETE ON static_pages TO kunacademy;
GRANT ALL                            ON static_pages TO kunacademy_admin;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Verify                                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $verify$
DECLARE
  v_table_exists  int;
  v_col_count     int;
  v_check_count   int;
  v_index_count   int;
  v_policy_count  int;
  v_trigger_count int;
BEGIN
  SELECT COUNT(*) INTO v_table_exists
    FROM information_schema.tables
    WHERE table_name = 'static_pages';
  IF v_table_exists <> 1 THEN
    RAISE EXCEPTION 'WAVE-15-W1: expected static_pages table, got %', v_table_exists;
  END IF;

  SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_name = 'static_pages';
  IF v_col_count < 18 THEN
    RAISE EXCEPTION 'WAVE-15-W1: expected ≥18 columns on static_pages, got %', v_col_count;
  END IF;

  SELECT COUNT(*) INTO v_check_count
    FROM pg_constraint
    WHERE conrelid = 'static_pages'::regclass AND contype = 'c';
  IF v_check_count < 4 THEN
    RAISE EXCEPTION 'WAVE-15-W1: expected ≥4 CHECK constraints on static_pages, got %', v_check_count;
  END IF;

  SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes WHERE tablename = 'static_pages';
  IF v_index_count < 6 THEN
    RAISE EXCEPTION 'WAVE-15-W1: expected ≥6 indexes on static_pages, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies WHERE tablename = 'static_pages';
  IF v_policy_count < 2 THEN
    RAISE EXCEPTION 'WAVE-15-W1: expected ≥2 RLS policies on static_pages, got %', v_policy_count;
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'static_pages'::regclass AND NOT tgisinternal;
  IF v_trigger_count < 2 THEN
    RAISE EXCEPTION 'WAVE-15-W1: expected ≥2 triggers on static_pages, got %', v_trigger_count;
  END IF;

  RAISE NOTICE 'WAVE-15-W1 0065 verified: static_pages (cols=%, checks=%, idx=%, policies=%, triggers=%)',
    v_col_count, v_check_count, v_index_count, v_policy_count, v_trigger_count;
END
$verify$;

COMMIT;
