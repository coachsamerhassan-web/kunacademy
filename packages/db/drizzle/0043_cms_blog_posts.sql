-- Migration 0043: CMS→DB Phase 3c — blog_posts schema alignment + data seed
--
-- Aligns the blog_posts table (table already exists from v2_remaining + 0005)
-- with the canonical CMS column naming used by events/programs/instructors, then
-- seeds the 30 real blog posts from apps/web/data/cms/blog.json.
--
-- The existing table has 0 rows, so column renames are loss-free.
--
-- Schema changes:
--   is_published    → published               (BOOLEAN)
--   featured_image  → featured_image_url      (TEXT)
--   body_ar         → content_ar              (TEXT)
--   body_en         → content_en              (TEXT)
--   ADD author_slug TEXT                   -- JSON source uses slug, not UUID
--   ADD reading_time_minutes INTEGER
--   ADD is_featured BOOLEAN NOT NULL DEFAULT false
--   ADD display_order INTEGER NOT NULL DEFAULT 0
--   ADD last_edited_by UUID NULL REFERENCES profiles(id)
--   ADD last_edited_at TIMESTAMPTZ NULL
--
-- Indexes: slug (unique, already exists), published_at DESC,
--          category, tags GIN, is_featured, display_order.
--
-- RLS: already enabled with public-read-published, author-read-own, admin-all.
-- Grants: already granted to anon/authenticated/kunacademy/kunacademy_admin.
-- Re-asserts GRANTS for safety (no-op if already granted).
--
-- Data source: apps/web/data/cms/blog.json (30 posts, all author_slug='samer-hassan').
-- Row count target: 30 (all published=true in source).

BEGIN;

-- ── Column renames (lossless: table has 0 rows) ────────────────────────────
ALTER TABLE blog_posts RENAME COLUMN is_published   TO published;
ALTER TABLE blog_posts RENAME COLUMN featured_image TO featured_image_url;
ALTER TABLE blog_posts RENAME COLUMN body_ar        TO content_ar;
ALTER TABLE blog_posts RENAME COLUMN body_en        TO content_en;

-- ── New CMS-canonical columns ──────────────────────────────────────────────
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS author_slug           TEXT,
  ADD COLUMN IF NOT EXISTS reading_time_minutes  INTEGER,
  ADD COLUMN IF NOT EXISTS is_featured           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_edited_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at        TIMESTAMPTZ;

-- ── Indexes (idempotent) ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx  ON blog_posts (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx      ON blog_posts (category) WHERE published = true;
CREATE INDEX IF NOT EXISTS blog_posts_tags_gin_idx      ON blog_posts USING GIN (tags);
CREATE INDEX IF NOT EXISTS blog_posts_featured_idx      ON blog_posts (is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS blog_posts_display_order_idx ON blog_posts (display_order);
CREATE INDEX IF NOT EXISTS blog_posts_author_slug_idx   ON blog_posts (author_slug);

-- ── Re-assert RLS + grants (no-op if already applied) ──────────────────────
-- RLS already enabled. Re-state the public-read policy using the renamed column.
DROP POLICY IF EXISTS blog_posts_public_select ON blog_posts;
CREATE POLICY blog_posts_public_select ON blog_posts
  FOR SELECT
  USING (published = true);

-- Admin policy (is_admin() uses app_uid; leave as-is).
DROP POLICY IF EXISTS blog_posts_admin ON blog_posts;
CREATE POLICY blog_posts_admin ON blog_posts
  FOR ALL
  USING (is_admin());

-- Author-read-own policy (optional, keep for symmetry).
DROP POLICY IF EXISTS blog_posts_author_select ON blog_posts;
CREATE POLICY blog_posts_author_select ON blog_posts
  FOR SELECT
  USING (author_id = app_uid());

-- Grants (no-op if already granted).
GRANT SELECT                         ON blog_posts TO anon;
GRANT SELECT                         ON blog_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON blog_posts TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON blog_posts TO kunacademy_admin;

-- ── Verification ───────────────────────────────────────────────────────────
DO $$
DECLARE v_cols int;
BEGIN
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_name = 'blog_posts'
     AND column_name IN (
       'slug','title_ar','title_en','content_ar','content_en',
       'excerpt_ar','excerpt_en','featured_image_url','category','tags',
       'author_slug','published','published_at','is_featured','display_order',
       'reading_time_minutes','meta_title_ar','meta_title_en',
       'meta_description_ar','meta_description_en',
       'content_doc_id','last_edited_by','last_edited_at'
     );
  IF v_cols < 23 THEN
    RAISE EXCEPTION 'blog_posts schema alignment failed: expected >=23 canonical cols, got %', v_cols;
  END IF;
  RAISE NOTICE 'blog_posts schema aligned: % canonical columns present', v_cols;
END $$;

COMMIT;
