-- Migration 0067 — Wave 15 Wave 1 — content_page_snapshots + content_edits.metadata
--
-- Source authority:
--   /Users/samer/Claude Code/Project Memory/KUN-Features/Specs/wave-15-unified-content-system-CONSOLIDATED.md §4.3 + §4.4
--   Wave 15 Wave 1 dispatch (2026-04-27)
--
-- Scope:
--   (1) content_page_snapshots — page-level snapshots fired on publish, archive,
--       manual checkpoint, pre-rollback, and migration boundaries (e.g. before
--       Wave 14b S2 schema sweep). Complements (does NOT duplicate) the
--       per-edit append-only audit in content_edits.
--   (2) content_edits.metadata — JSONB column for { model, prompt_summary_hash,
--       session_id, confidence } and similar agent-write provenance.
--   (3) content_edits.change_kind values widened by CHECK constraint to include
--       transition_review, transition_approved, transition_published,
--       transition_archived, lint_block, lint_warn (Wave 15 §4.4).
--   (4) Append-only enforcement on content_page_snapshots:
--       a. REVOKE UPDATE/DELETE from kunacademy/kunacademy_admin
--       b. BEFORE UPDATE trigger raises EXCEPTION (defense against admin role
--          inheritance bypass per learned-pattern 2026-04-26)
--       c. BEFORE DELETE trigger raises EXCEPTION (defense in depth)
--
-- IP / dignity boundary (per CLAUDE.md):
--   Snapshots are full-row copies. They WILL contain methodology copy if the
--   page being snapshot has methodology copy. The snapshot is admin-only
--   (anon cannot SELECT) and the rollback flow re-validates against current
--   lint rules before re-publishing. No methodology leak via snapshots.
--
-- Idempotency:
--   CREATE TABLE IF NOT EXISTS — re-run safe.
--   DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS — re-run safe.
--   ALTER TABLE … ADD COLUMN IF NOT EXISTS — re-run safe.
--   GRANTs / REVOKEs are idempotent.
--   CHECK constraints guarded by EXISTS in pg_constraint.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. content_page_snapshots — page-level snapshot table                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS content_page_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which entity table this snapshot belongs to.
  entity                text NOT NULL,
  entity_id             uuid NOT NULL,

  -- Full-row JSONB copy at snapshot time. Shape mirrors the source row
  -- (composition_json, hero_json, seo_meta_json, status, slug, etc.).
  snapshot              jsonb NOT NULL,

  -- Why this snapshot was taken — drives retention + UX.
  reason                text NOT NULL,

  -- Who took the snapshot. taken_by_kind ∈ {'human','agent','system'};
  -- taken_by_id resolves to profiles.id (human) | agent_tokens.id (agent) | NULL (system).
  taken_by_kind         text NOT NULL,
  taken_by_id           uuid,
  taken_by_name         text,

  -- Optional FK to the content_edits row that triggered the snapshot
  -- (e.g. the transition_published edit that fires the publish-time snapshot).
  edit_id               uuid REFERENCES content_edits(id) ON DELETE SET NULL,

  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE content_page_snapshots IS
  'Wave 15 Wave 1 — page-level snapshots for O(1) "what did this page look '
  'like on day X" rollback. Complements content_edits per-edit audit, NOT a '
  'replacement. Fires on publish/archive/manual checkpoint/pre-rollback/'
  'migration boundaries. Append-only: REVOKE UPDATE/DELETE + BEFORE UPDATE/'
  'DELETE triggers as defense-in-depth against admin-role-inheritance bypass.';

COMMENT ON COLUMN content_page_snapshots.reason IS
  'publish | archive | manual | pre_rollback | migration. Drives retention + '
  'UX (manual checkpoints surface in editor; pre_rollback are diagnostic).';

COMMENT ON COLUMN content_page_snapshots.snapshot IS
  'Full-row JSONB copy. Re-rendered by the rollback flow; lint re-runs '
  'against current rules before any rollback re-publishes the snapshotted '
  'state. No raw lookup of snapshot.composition_json content as if it were '
  'fresh — it is historical evidence, not live config.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. CHECK constraints on content_page_snapshots                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- entity ∈ {'landing_pages','blog_posts','static_pages'} (extensible later)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'content_page_snapshots'::regclass
      AND conname  = 'content_page_snapshots_entity_chk'
  ) THEN
    ALTER TABLE content_page_snapshots
      ADD CONSTRAINT content_page_snapshots_entity_chk
      CHECK (entity IN ('landing_pages','blog_posts','static_pages'));
  END IF;
END $$;

-- reason ∈ {'publish','archive','manual','pre_rollback','migration'}
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'content_page_snapshots'::regclass
      AND conname  = 'content_page_snapshots_reason_chk'
  ) THEN
    ALTER TABLE content_page_snapshots
      ADD CONSTRAINT content_page_snapshots_reason_chk
      CHECK (reason IN ('publish','archive','manual','pre_rollback','migration'));
  END IF;
END $$;

-- taken_by_kind ∈ {'human','agent','system'}
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'content_page_snapshots'::regclass
      AND conname  = 'content_page_snapshots_taken_by_kind_chk'
  ) THEN
    ALTER TABLE content_page_snapshots
      ADD CONSTRAINT content_page_snapshots_taken_by_kind_chk
      CHECK (taken_by_kind IN ('human','agent','system'));
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Indexes on content_page_snapshots                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS content_page_snapshots_entity_idx
  ON content_page_snapshots (entity, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_page_snapshots_reason_idx
  ON content_page_snapshots (reason, created_at DESC);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. RLS on content_page_snapshots — admin-only                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE content_page_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_page_snapshots_admin_all  ON content_page_snapshots;
DROP POLICY IF EXISTS content_page_snapshots_anon_block ON content_page_snapshots;

-- Admin-only access. Snapshots include unpublished / archived rows; anon must
-- never see them. Service helpers use kunacademy_admin via withAdminContext.
CREATE POLICY content_page_snapshots_admin_all ON content_page_snapshots
  FOR ALL
  TO kunacademy_admin
  USING (true)
  WITH CHECK (true);

-- Anon explicitly blocked — clarity over relying on absence-of-grant.
CREATE POLICY content_page_snapshots_anon_block ON content_page_snapshots
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Append-only enforcement (defense in depth)                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Per learned-pattern 2026-04-26 (scholarship_tokens): column-grant restriction
-- is silently bypassable when an app role inherits from an admin role. The
-- BEFORE UPDATE / BEFORE DELETE triggers are the actual immutability boundary.
--
-- We grant SELECT + INSERT only (no UPDATE / DELETE) and additionally enforce
-- via triggers that fire for ALL roles including postgres — explicit bracket
-- via ALTER TABLE … DISABLE TRIGGER required for emergency repair.

GRANT SELECT, INSERT ON content_page_snapshots TO kunacademy;
GRANT SELECT, INSERT ON content_page_snapshots TO kunacademy_admin;

-- Defensive REVOKE (idempotent).
REVOKE UPDATE, DELETE, TRUNCATE ON content_page_snapshots FROM kunacademy;
REVOKE UPDATE, DELETE, TRUNCATE ON content_page_snapshots FROM kunacademy_admin;

CREATE OR REPLACE FUNCTION content_page_snapshots_block_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'content_page_snapshots is append-only (UPDATE blocked). '
                  'For emergency repair: ALTER TABLE … DISABLE TRIGGER '
                  'content_page_snapshots_block_update_trg.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_page_snapshots_block_update_trg ON content_page_snapshots;
CREATE TRIGGER content_page_snapshots_block_update_trg
  BEFORE UPDATE ON content_page_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION content_page_snapshots_block_update();

CREATE OR REPLACE FUNCTION content_page_snapshots_block_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'content_page_snapshots is append-only (DELETE blocked). '
                  'For emergency repair: ALTER TABLE … DISABLE TRIGGER '
                  'content_page_snapshots_block_delete_trg.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_page_snapshots_block_delete_trg ON content_page_snapshots;
CREATE TRIGGER content_page_snapshots_block_delete_trg
  BEFORE DELETE ON content_page_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION content_page_snapshots_block_delete();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. content_edits — extension                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- (a) Add `metadata` JSONB column. Optional; agents populate with model +
--     prompt_summary_hash + session_id + confidence; humans may leave NULL.

ALTER TABLE content_edits
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN content_edits.metadata IS
  'Wave 15 Wave 1 — optional provenance bundle. Shape: { model, '
  'prompt_summary_hash, session_id, confidence, ... }. Humans may leave NULL.';

-- (b) Widen change_kind via a CHECK whitelist. Existing values in DB:
--     'scalar' (current default), 'rich_text_replaced'. New values:
--     'transition_review', 'transition_approved', 'transition_published',
--     'transition_archived', 'lint_block', 'lint_warn'.
--
-- Note: change_kind is NOT a Postgres ENUM (kunacademy convention is
-- text-with-CHECK per migration 0036 precedent). Migration 0057 declared the
-- column without an explicit CHECK. We add one now to formally constrain
-- the whitelist.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'content_edits'::regclass
      AND conname  = 'content_edits_change_kind_chk'
  ) THEN
    ALTER TABLE content_edits
      ADD CONSTRAINT content_edits_change_kind_chk
      CHECK (change_kind IN (
        'scalar',
        'rich_text_replaced',
        'transition_review',
        'transition_approved',
        'transition_published',
        'transition_archived',
        'lint_block',
        'lint_warn'
      ));
  END IF;
END $$;

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
  v_trigger_count int;
  v_metadata_col  int;
  v_change_kind_chk int;
BEGIN
  SELECT COUNT(*) INTO v_table_exists
    FROM information_schema.tables
    WHERE table_name = 'content_page_snapshots';
  IF v_table_exists <> 1 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0067: expected content_page_snapshots table, got %', v_table_exists;
  END IF;

  SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_name = 'content_page_snapshots';
  IF v_col_count <> 10 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0067: expected 10 columns on content_page_snapshots, got %', v_col_count;
  END IF;

  SELECT COUNT(*) INTO v_check_count
    FROM pg_constraint
    WHERE conrelid = 'content_page_snapshots'::regclass AND contype = 'c';
  IF v_check_count < 3 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0067: expected ≥3 CHECK on content_page_snapshots, got %', v_check_count;
  END IF;

  SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes WHERE tablename = 'content_page_snapshots';
  IF v_index_count < 3 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0067: expected ≥3 indexes on content_page_snapshots, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies WHERE tablename = 'content_page_snapshots';
  IF v_policy_count < 2 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0067: expected ≥2 RLS policies, got %', v_policy_count;
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'content_page_snapshots'::regclass AND NOT tgisinternal;
  IF v_trigger_count < 2 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0067: expected ≥2 append-only triggers, got %', v_trigger_count;
  END IF;

  SELECT COUNT(*) INTO v_metadata_col
    FROM information_schema.columns
    WHERE table_name = 'content_edits' AND column_name = 'metadata';
  IF v_metadata_col <> 1 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0067: content_edits.metadata column missing';
  END IF;

  SELECT COUNT(*) INTO v_change_kind_chk
    FROM pg_constraint
    WHERE conrelid = 'content_edits'::regclass
      AND conname  = 'content_edits_change_kind_chk';
  IF v_change_kind_chk <> 1 THEN
    RAISE EXCEPTION 'WAVE-15-W1 0067: content_edits change_kind CHECK missing';
  END IF;

  RAISE NOTICE 'WAVE-15-W1 0067 verified: snapshots (cols=%, checks=%, idx=%, policies=%, triggers=%) + content_edits.metadata + change_kind CHECK',
    v_col_count, v_check_count, v_index_count, v_policy_count, v_trigger_count;
END
$verify$;

COMMIT;
