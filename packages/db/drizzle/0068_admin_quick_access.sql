-- Migration 0068 — Phase 1d-B — admin_quick_access
--
-- Source authority:
--   /Users/samer/Claude Code/Project Memory/KUN-Features/Workspace/CTO/output/2026-04-30-comprehensive-ux-patch-NEXT-SESSION-PROMPT.md
--   Samer 2026-04-30 directive: "I need to be able to add more to the Quick Access section"
--
-- Scope:
--   (1) admin_quick_access — DB-backed quick-access tiles for /admin landing.
--       Replaces the hardcoded 9-tile array in apps/web/src/app/[locale]/admin/page.tsx
--       (Phase 1b output, lines 113-213).
--   (2) Seed with the 9 existing tiles (label_ar, label_en, href, icon_path,
--       color_token, sort_order) so the canary surface stays byte-identical
--       at deploy moment, then the admin can add/edit/reorder/deactivate.
--   (3) RLS — admin-only read/write (super_admin or admin role).
--
-- What this REPLACES:
--   - The hardcoded `tiles` array in apps/web/src/app/[locale]/admin/page.tsx
--     (Phase 1b output, lines 113-213). Migration adds the table; the renderer
--     refactor removes the array and fetches from this table instead.
--
-- IP / dignity boundary (per CLAUDE.md):
--   Quick-access tiles are admin navigation shortcuts. They contain NO
--   methodology copy and pose NO IP risk. This is internal nav data only.
--
-- Idempotency:
--   CREATE TABLE IF NOT EXISTS — re-run safe.
--   Seed via INSERT … ON CONFLICT DO NOTHING (anchored on href uniqueness).
--   GRANTs / REVOKEs / POLICIES are idempotent.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. admin_quick_access — table                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS admin_quick_access (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_ar      text NOT NULL,
  label_en      text NOT NULL,
  href          text NOT NULL,
  icon_path     text NOT NULL,        -- SVG path d-attribute (Heroicons-outline style)
  color_token   text NOT NULL,        -- one of mandarin|sky|primary|charleston|rose|deepsky|sand|mist|violet|amber|jade
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_quick_access IS
  'Phase 1d-B (2026-04-30) — DB-backed quick-access tiles on /admin landing. '
  'Replaces hardcoded tiles array. Admin-managed via /admin/quick-access UI.';

COMMENT ON COLUMN admin_quick_access.icon_path IS
  'SVG path d-attribute. Copy from Heroicons-outline (https://heroicons.com).';

COMMENT ON COLUMN admin_quick_access.color_token IS
  'Maps to var(--shell-tile-{token}-bg) + var(--shell-tile-{token}-icon). '
  'Constrained to brand-approved palette; admin picks from a fixed dropdown.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. CHECK constraints                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'admin_quick_access'::regclass
      AND conname  = 'admin_quick_access_color_token_chk'
  ) THEN
    ALTER TABLE admin_quick_access
      ADD CONSTRAINT admin_quick_access_color_token_chk
      CHECK (color_token IN ('mandarin','sky','primary','charleston','rose','deepsky','sand','mist','violet','amber','jade'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'admin_quick_access'::regclass
      AND conname  = 'admin_quick_access_label_ar_nonblank_chk'
  ) THEN
    ALTER TABLE admin_quick_access
      ADD CONSTRAINT admin_quick_access_label_ar_nonblank_chk
      CHECK (length(trim(label_ar)) > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'admin_quick_access'::regclass
      AND conname  = 'admin_quick_access_label_en_nonblank_chk'
  ) THEN
    ALTER TABLE admin_quick_access
      ADD CONSTRAINT admin_quick_access_label_en_nonblank_chk
      CHECK (length(trim(label_en)) > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'admin_quick_access'::regclass
      AND conname  = 'admin_quick_access_href_starts_slash_chk'
  ) THEN
    ALTER TABLE admin_quick_access
      ADD CONSTRAINT admin_quick_access_href_starts_slash_chk
      CHECK (href LIKE '/%' OR href LIKE 'http%');
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Indexes                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS admin_quick_access_active_sort_idx
  ON admin_quick_access (is_active, sort_order) WHERE is_active = true;

-- Used by the seed/conflict logic + admin uniqueness expectations.
CREATE UNIQUE INDEX IF NOT EXISTS admin_quick_access_href_uq
  ON admin_quick_access (href);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. updated_at maintenance trigger                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION admin_quick_access_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_quick_access_touch_updated_at_trg ON admin_quick_access;
CREATE TRIGGER admin_quick_access_touch_updated_at_trg
  BEFORE UPDATE ON admin_quick_access
  FOR EACH ROW
  EXECUTE FUNCTION admin_quick_access_touch_updated_at();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. RLS — admin-only                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE admin_quick_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_quick_access_admin_all  ON admin_quick_access;
DROP POLICY IF EXISTS admin_quick_access_anon_block ON admin_quick_access;

CREATE POLICY admin_quick_access_admin_all ON admin_quick_access
  FOR ALL
  TO kunacademy_admin
  USING (true)
  WITH CHECK (true);

CREATE POLICY admin_quick_access_anon_block ON admin_quick_access
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON admin_quick_access TO kunacademy_admin;
GRANT SELECT ON admin_quick_access TO kunacademy;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Seed — replicate the 9 existing tiles                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Anchored on href; ON CONFLICT DO NOTHING so re-running the migration is safe
-- and so admins who edit a tile post-deploy don't get their changes overwritten.

INSERT INTO admin_quick_access (label_ar, label_en, href, icon_path, color_token, sort_order, is_active)
VALUES
  ('الكوتشز', 'Coaches', '/admin/instructors',
    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    'mandarin', 10, true),
  ('الطلبات', 'Orders', '/admin/orders',
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    'sky', 20, true),
  ('الدورات', 'Courses', '/admin/courses',
    'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    'primary', 30, true),
  ('المنتجات', 'Products', '/admin/products',
    'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    'charleston', 40, true),
  ('التوصيات', 'Testimonials', '/admin/testimonials',
    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    'rose', 50, true),
  ('المحتوى', 'Content', '/admin/content',
    'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    'deepsky', 60, true),
  ('المجتمع', 'Community', '/admin/community',
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    'sand', 70, true),
  ('رسائل فاشلة', 'Email Outbox', '/admin/email-outbox',
    'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    'mist', 80, true),
  ('مكتبة الدروس', 'Lesson Library', '/admin/lessons',
    'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    'violet', 90, true)
ON CONFLICT (href) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Verify                                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $verify$
DECLARE
  v_table_exists  int;
  v_col_count     int;
  v_check_count   int;
  v_index_count   int;
  v_policy_count  int;
  v_seed_count    int;
  v_trigger_count int;
BEGIN
  SELECT COUNT(*) INTO v_table_exists
    FROM information_schema.tables
    WHERE table_name = 'admin_quick_access';
  IF v_table_exists <> 1 THEN
    RAISE EXCEPTION 'PHASE-1d-B 0068: expected admin_quick_access table, got %', v_table_exists;
  END IF;

  SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_name = 'admin_quick_access';
  IF v_col_count <> 10 THEN
    RAISE EXCEPTION 'PHASE-1d-B 0068: expected 10 columns on admin_quick_access, got %', v_col_count;
  END IF;

  SELECT COUNT(*) INTO v_check_count
    FROM pg_constraint
    WHERE conrelid = 'admin_quick_access'::regclass AND contype = 'c';
  IF v_check_count < 4 THEN
    RAISE EXCEPTION 'PHASE-1d-B 0068: expected ≥4 CHECK on admin_quick_access, got %', v_check_count;
  END IF;

  SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes WHERE tablename = 'admin_quick_access';
  IF v_index_count < 2 THEN
    RAISE EXCEPTION 'PHASE-1d-B 0068: expected ≥2 indexes, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies WHERE tablename = 'admin_quick_access';
  IF v_policy_count < 2 THEN
    RAISE EXCEPTION 'PHASE-1d-B 0068: expected ≥2 RLS policies, got %', v_policy_count;
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'admin_quick_access'::regclass AND NOT tgisinternal;
  IF v_trigger_count < 1 THEN
    RAISE EXCEPTION 'PHASE-1d-B 0068: expected ≥1 trigger (touch_updated_at), got %', v_trigger_count;
  END IF;

  SELECT COUNT(*) INTO v_seed_count FROM admin_quick_access WHERE is_active = true;
  IF v_seed_count < 9 THEN
    RAISE EXCEPTION 'PHASE-1d-B 0068: expected ≥9 active seed rows, got %', v_seed_count;
  END IF;

  RAISE NOTICE 'PHASE-1d-B 0068 verified: admin_quick_access (cols=%, checks=%, idx=%, policies=%, triggers=%, seed=%)',
    v_col_count, v_check_count, v_index_count, v_policy_count, v_trigger_count, v_seed_count;
END
$verify$;

COMMIT;
