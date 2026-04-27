-- Migration 0066 — Wave 15 Wave 1 — Status state machine + blog *_rich + kind discriminator
--
-- Source authority:
--   /Users/samer/Claude Code/Project Memory/KUN-Features/Specs/wave-15-unified-content-system-CONSOLIDATED.md §4.2
--   Wave 15 Wave 1 dispatch (2026-04-27)
--
-- Scope (purely additive — non-breaking ADDs to landing_pages + blog_posts):
--   (1) landing_pages: + status / scheduled_publish_at / last_edited_by_kind /
--       last_edited_by_name. Backfill: published=true → status='published';
--       published=false → status='draft'.
--   (2) blog_posts: + the same four columns + kind ('blog_article' default,
--       'announcement_post' alt) + composition_json (for sectioned long-form
--       posts) + content_ar_rich / content_en_rich / excerpt_ar_rich /
--       excerpt_en_rich (TipTap JSON companions to scalar content_*).
--   (3) Sync triggers on both tables: keep `published BOOLEAN` in sync with
--       `status='published'` so existing readers (`WHERE published=true`)
--       keep working.
--   (4) Indexes on `status` for both tables.
--
-- IP / dignity boundary (per CLAUDE.md):
--   Schema-only additions. No copy migrated. The new *_rich columns will
--   carry IP-classified text only after Wave 2 lints (R1-R13) clear.
--
-- Idempotency:
--   ALTER TABLE … ADD COLUMN IF NOT EXISTS — re-run safe.
--   Backfill UPDATEs use guarded WHERE clauses so re-run is a no-op.
--   CHECK constraints guarded by EXISTS in pg_constraint.
--   CREATE OR REPLACE on trigger functions; DROP TRIGGER IF EXISTS first.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. landing_pages — non-breaking ADDs                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE landing_pages
  ADD COLUMN IF NOT EXISTS status               text,
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_edited_by_kind  text,
  ADD COLUMN IF NOT EXISTS last_edited_by_name  text;

COMMENT ON COLUMN landing_pages.status IS
  'Wave 15 status state machine: draft | review | published | archived. '
  'Authoritative; the existing `published` boolean is mirrored from this '
  'via the sync trigger for backwards-compat reads.';

COMMENT ON COLUMN landing_pages.scheduled_publish_at IS
  'When set + status=review, the publish-cron flips to status=published at '
  'or after this time (Wave 15 D13). NULL = not scheduled.';

COMMENT ON COLUMN landing_pages.last_edited_by_kind IS
  'Authorship discriminator for last_edited_by: human | agent | system. '
  'Human → existing last_edited_by uuid is profiles.id; agent → existing '
  'last_edited_by uuid is agent_tokens.id; system → NULL.';

-- Backfill BEFORE applying NOT NULL + CHECK, in two guarded UPDATEs.
-- Idempotent: only flip rows that haven't been backfilled yet.
UPDATE landing_pages SET status = 'published' WHERE status IS NULL AND published = true;
UPDATE landing_pages SET status = 'draft'     WHERE status IS NULL AND published = false;

-- Backfill last_edited_by_kind for any pre-existing rows (all human; agent
-- writes only existed from Wave 15 P1.5 forward and audited via content_edits,
-- not denormalized on landing_pages itself).
UPDATE landing_pages SET last_edited_by_kind = 'human' WHERE last_edited_by_kind IS NULL;

-- Now apply NOT NULL + DEFAULT (DEFAULT for future inserts; rows are already
-- backfilled so SET NOT NULL succeeds).
ALTER TABLE landing_pages
  ALTER COLUMN status              SET NOT NULL,
  ALTER COLUMN status              SET DEFAULT 'draft',
  ALTER COLUMN last_edited_by_kind SET NOT NULL,
  ALTER COLUMN last_edited_by_kind SET DEFAULT 'human';

-- CHECK on status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'landing_pages'::regclass
      AND conname  = 'landing_pages_status_chk'
  ) THEN
    ALTER TABLE landing_pages
      ADD CONSTRAINT landing_pages_status_chk
      CHECK (status IN ('draft','review','published','archived'));
  END IF;
END $$;

-- CHECK on last_edited_by_kind
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'landing_pages'::regclass
      AND conname  = 'landing_pages_last_edited_by_kind_chk'
  ) THEN
    ALTER TABLE landing_pages
      ADD CONSTRAINT landing_pages_last_edited_by_kind_chk
      CHECK (last_edited_by_kind IN ('human','agent','system'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS landing_pages_status_idx    ON landing_pages (status);
CREATE INDEX IF NOT EXISTS landing_pages_scheduled_idx ON landing_pages (scheduled_publish_at)
  WHERE scheduled_publish_at IS NOT NULL;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. landing_pages — sync trigger (status ↔ published BOOLEAN)             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION landing_pages_sync_published_boolean()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger fires on INSERT (always) and UPDATE OF status (only when status
  -- changes). Keep boolean + published_at in lockstep with status='published'.
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

DROP TRIGGER IF EXISTS landing_pages_sync_published_boolean_trg ON landing_pages;
CREATE TRIGGER landing_pages_sync_published_boolean_trg
  BEFORE INSERT OR UPDATE OF status ON landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION landing_pages_sync_published_boolean();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. blog_posts — non-breaking ADDs                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS status               text,
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_edited_by_kind  text,
  ADD COLUMN IF NOT EXISTS last_edited_by_name  text,
  ADD COLUMN IF NOT EXISTS kind                 text,
  ADD COLUMN IF NOT EXISTS composition_json     jsonb,
  ADD COLUMN IF NOT EXISTS content_ar_rich      jsonb,
  ADD COLUMN IF NOT EXISTS content_en_rich      jsonb,
  ADD COLUMN IF NOT EXISTS excerpt_ar_rich      jsonb,
  ADD COLUMN IF NOT EXISTS excerpt_en_rich      jsonb;

COMMENT ON COLUMN blog_posts.status IS
  'Wave 15 status state machine — same domain as landing_pages.status.';

COMMENT ON COLUMN blog_posts.kind IS
  'Editorial kind: blog_article (default) | announcement_post. Per Hakima §1 '
  'taxonomy — both live in blog_posts table; routing differs (Wave 4).';

COMMENT ON COLUMN blog_posts.composition_json IS
  'Optional sectioned long-form composition (Wave 16 promotion to rich '
  'authoring). NULL = falls back to scalar content_ar/en + *_rich for body.';

COMMENT ON COLUMN blog_posts.content_ar_rich IS
  'TipTap JSON companion to scalar content_ar. Authored via BilingualRichEditor; '
  'rendered via RichContent component. Maintained in lockstep with content_ar '
  'via markdown-adapter round-trip (Wave 15 P2 pattern).';

-- Backfill BEFORE applying NOT NULL + CHECK.
-- blog_posts.published is nullable — treat NULL as false.
UPDATE blog_posts SET status = 'published'
  WHERE status IS NULL AND published = true;
UPDATE blog_posts SET status = 'draft'
  WHERE status IS NULL AND (published IS DISTINCT FROM true);

UPDATE blog_posts SET last_edited_by_kind = 'human' WHERE last_edited_by_kind IS NULL;

UPDATE blog_posts SET kind = 'blog_article' WHERE kind IS NULL;

-- Apply NOT NULL + DEFAULT for future inserts.
ALTER TABLE blog_posts
  ALTER COLUMN status              SET NOT NULL,
  ALTER COLUMN status              SET DEFAULT 'draft',
  ALTER COLUMN last_edited_by_kind SET NOT NULL,
  ALTER COLUMN last_edited_by_kind SET DEFAULT 'human',
  ALTER COLUMN kind                SET NOT NULL,
  ALTER COLUMN kind                SET DEFAULT 'blog_article';

-- CHECK on status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'blog_posts'::regclass
      AND conname  = 'blog_posts_status_chk'
  ) THEN
    ALTER TABLE blog_posts
      ADD CONSTRAINT blog_posts_status_chk
      CHECK (status IN ('draft','review','published','archived'));
  END IF;
END $$;

-- CHECK on last_edited_by_kind
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'blog_posts'::regclass
      AND conname  = 'blog_posts_last_edited_by_kind_chk'
  ) THEN
    ALTER TABLE blog_posts
      ADD CONSTRAINT blog_posts_last_edited_by_kind_chk
      CHECK (last_edited_by_kind IN ('human','agent','system'));
  END IF;
END $$;

-- CHECK on kind
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'blog_posts'::regclass
      AND conname  = 'blog_posts_kind_chk'
  ) THEN
    ALTER TABLE blog_posts
      ADD CONSTRAINT blog_posts_kind_chk
      CHECK (kind IN ('blog_article','announcement_post'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS blog_posts_status_idx    ON blog_posts (status);
CREATE INDEX IF NOT EXISTS blog_posts_scheduled_idx ON blog_posts (scheduled_publish_at)
  WHERE scheduled_publish_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS blog_posts_kind_idx      ON blog_posts (kind);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. blog_posts — sync trigger                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Note on existing reader paths:
--   blog_posts.published_at_idx (`published_at DESC NULLS LAST`) and
--   idx_blog_posts_published (`published_at DESC WHERE published=true`) both
--   key on the boolean. We keep the boolean in sync via this trigger so the
--   existing /blog/[slug] reads (`WHERE published=true`) keep working.

CREATE OR REPLACE FUNCTION blog_posts_sync_published_boolean()
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

DROP TRIGGER IF EXISTS blog_posts_sync_published_boolean_trg ON blog_posts;
CREATE TRIGGER blog_posts_sync_published_boolean_trg
  BEFORE INSERT OR UPDATE OF status ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION blog_posts_sync_published_boolean();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Verify                                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $verify$
DECLARE
  v_lp_new_cols   int;
  v_bp_new_cols   int;
  v_lp_status_cnt int;
  v_bp_status_cnt int;
  v_lp_null_status int;
  v_bp_null_status int;
  v_lp_trigger    int;
  v_bp_trigger    int;
BEGIN
  -- New cols on landing_pages
  SELECT COUNT(*) INTO v_lp_new_cols
    FROM information_schema.columns
    WHERE table_name = 'landing_pages'
      AND column_name IN ('status','scheduled_publish_at','last_edited_by_kind','last_edited_by_name');
  IF v_lp_new_cols <> 4 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0066: expected 4 new cols on landing_pages, got %', v_lp_new_cols;
  END IF;

  -- New cols on blog_posts
  SELECT COUNT(*) INTO v_bp_new_cols
    FROM information_schema.columns
    WHERE table_name = 'blog_posts'
      AND column_name IN ('status','scheduled_publish_at','last_edited_by_kind','last_edited_by_name','kind','composition_json','content_ar_rich','content_en_rich','excerpt_ar_rich','excerpt_en_rich');
  IF v_bp_new_cols <> 10 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0066: expected 10 new cols on blog_posts, got %', v_bp_new_cols;
  END IF;

  -- No NULL status anywhere
  SELECT COUNT(*) INTO v_lp_null_status FROM landing_pages WHERE status IS NULL;
  IF v_lp_null_status > 0 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0066: % landing_pages rows still have NULL status', v_lp_null_status;
  END IF;
  SELECT COUNT(*) INTO v_bp_null_status FROM blog_posts WHERE status IS NULL;
  IF v_bp_null_status > 0 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0066: % blog_posts rows still have NULL status', v_bp_null_status;
  END IF;

  -- Status counts (both tables): published rows backfilled to 'published'
  SELECT COUNT(*) INTO v_lp_status_cnt FROM landing_pages WHERE status = 'published' AND published = true;
  SELECT COUNT(*) INTO v_bp_status_cnt FROM blog_posts    WHERE status = 'published' AND published = true;
  RAISE NOTICE 'WAVE-15-W1 0066 backfill: landing_pages published=% blog_posts published=%',
    v_lp_status_cnt, v_bp_status_cnt;

  -- Triggers exist
  SELECT COUNT(*) INTO v_lp_trigger
    FROM pg_trigger
    WHERE tgrelid = 'landing_pages'::regclass
      AND tgname  = 'landing_pages_sync_published_boolean_trg';
  IF v_lp_trigger <> 1 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0066: landing_pages sync trigger missing';
  END IF;

  SELECT COUNT(*) INTO v_bp_trigger
    FROM pg_trigger
    WHERE tgrelid = 'blog_posts'::regclass
      AND tgname  = 'blog_posts_sync_published_boolean_trg';
  IF v_bp_trigger <> 1 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0066: blog_posts sync trigger missing';
  END IF;

  RAISE NOTICE 'WAVE-15-W1 0066 verified: status machine + blog *_rich + sync triggers';
END
$verify$;

COMMIT;
