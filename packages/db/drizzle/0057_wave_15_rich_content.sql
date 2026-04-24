-- 0057_wave_15_rich_content.sql
-- Wave 15 — Global Rich Content Editor (Phase 1 + Phase 1.5 Agent API)
--
-- Source of truth: /Users/samer/Claude Code/Project Memory/KUN-Website/Execution/
-- Scope: THREE new tables. Strictly additive. No changes to existing schema.
--
--   1. content_media          — index of uploaded images (VPS-stored)
--   2. agent_tokens           — Phase 1.5: per-agent API tokens + scope
--   3. content_edits          — Phase 1.5: unified audit trail (human + agent)
--
-- All tables locked down with RLS. Admin-role reads/writes via withAdminContext
-- pattern (matching landing_pages + lp_leads approach from 0052).
--
-- Idempotent: every CREATE uses IF NOT EXISTS. Safe to re-run.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. content_media — uploaded image index
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_media (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        text NOT NULL,       -- storage-side filename (UUID.ext)
  original_name   text NOT NULL,       -- what the user uploaded (for display/download)
  content_type    text NOT NULL,       -- image/jpeg | image/png | image/webp | image/gif
  size_bytes      bigint NOT NULL,
  file_path       text NOT NULL,       -- absolute VPS path
  url             text NOT NULL,       -- public URL (/uploads/media/...)
  alt_ar          text,                -- Arabic alt text (nullable — not all images need both)
  alt_en          text,                -- English alt text
  width           integer,             -- best-effort probe via sharp/image-size
  height          integer,
  uploaded_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  -- Phase 1.5: track whether uploaded by human (null) or agent (agent_tokens.id)
  uploaded_by_agent_token uuid,  -- FK added after agent_tokens exists, below
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  content_media IS
  'Uploaded image index for rich-content editing. VPS-stored (no S3/R2). Admin + content_editor upload; anon can only read the file itself via nginx static serve.';
COMMENT ON COLUMN content_media.alt_ar IS
  'Required when image is used in Arabic content. Enforced at upload time.';
COMMENT ON COLUMN content_media.alt_en IS
  'Required when image is used in English content. Enforced at upload time.';
COMMENT ON COLUMN content_media.uploaded_by_agent_token IS
  'When an agent uploaded via Phase 1.5 API, this references the token used. Null for human uploads.';

CREATE INDEX IF NOT EXISTS idx_content_media_uploaded_at
  ON content_media(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_media_uploaded_by
  ON content_media(uploaded_by);

ALTER TABLE content_media ENABLE ROW LEVEL SECURITY;

-- Admin role bypasses RLS entirely. The app role can SELECT its own uploads
-- for the media-picker UI in the future; for now deny-all via RLS except
-- through withAdminContext.
DROP POLICY IF EXISTS content_media_admin_all ON content_media;
CREATE POLICY content_media_admin_all
  ON content_media
  FOR ALL
  TO kunacademy_admin
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- 2. agent_tokens — Phase 1.5 per-agent API credentials
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name     text NOT NULL,        -- 'rafik' | 'hakima' | 'shahira' | 'sani' | 'amin' | 'nashit' | 'hakawati'
  token_hash     text NOT NULL UNIQUE, -- sha256 of the token (unique globally)
  token_prefix   text NOT NULL,        -- first 18 chars of the token for identification in logs
  scopes         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- scopes shape: { entities: ['landing_pages', 'programs', ...], actions: ['read','write'] }
  rate_limit_per_min integer NOT NULL DEFAULT 60,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  last_used_ip   text,
  revoked_at     timestamptz,
  revoked_reason text,
  -- Additional notes for operators
  notes          text
);

COMMENT ON TABLE  agent_tokens IS
  'Per-agent API credentials for Phase 1.5 Agent Content API. Tokens are hashed at rest; plaintext only exists transiently at creation time and must be written to Project Memory/KUN-Website/Execution/agent-tokens.md (gitignored).';
COMMENT ON COLUMN agent_tokens.scopes IS
  'Shape: {"entities": ["landing_pages","programs",...], "actions": ["read","write"], "fields_excluded": [...]}. Enforces per-agent ownership of content domains.';

CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent_name
  ON agent_tokens(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_revoked_at
  ON agent_tokens(revoked_at) WHERE revoked_at IS NULL;

-- Exactly ONE active (non-revoked) token per agent at any time.
-- Historical revoked rows stay for audit (content_edits.editor_id points here).
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_tokens_active_agent
  ON agent_tokens(agent_name) WHERE revoked_at IS NULL;

ALTER TABLE agent_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_tokens_admin_all ON agent_tokens;
CREATE POLICY agent_tokens_admin_all
  ON agent_tokens
  FOR ALL
  TO kunacademy_admin
  USING (true)
  WITH CHECK (true);

-- Now back-fill the FK on content_media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_media_uploaded_by_agent_token_fkey'
  ) THEN
    ALTER TABLE content_media
      ADD CONSTRAINT content_media_uploaded_by_agent_token_fkey
      FOREIGN KEY (uploaded_by_agent_token) REFERENCES agent_tokens(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. content_edits — unified audit trail for humans AND agents
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_edits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity            text NOT NULL,           -- 'landing_pages' | 'programs' | 'blog_posts' | ...
  entity_id         uuid NOT NULL,           -- PK of the edited row
  field             text NOT NULL,           -- 'description_ar' | 'composition_json' | ...
  editor_type       text NOT NULL,           -- 'human' | 'agent'
  editor_id         uuid,                    -- profiles.id OR agent_tokens.id
  editor_name       text,                    -- denormalized for display (email / agent_name)
  -- Store deltas rather than full snapshots — rich-text blobs blow up otherwise.
  -- For small scalar fields we still store full values.
  previous_value    jsonb,
  new_value         jsonb,
  -- Diff metadata: "rich_text_replaced" | "rich_text_patched" | "scalar" | "jsonb_merged"
  change_kind       text NOT NULL DEFAULT 'scalar',
  -- Free-form reason (e.g. agent's commit message)
  reason            text,
  -- Request metadata — forensic
  ip_address        text,
  user_agent        text,
  edit_source       text NOT NULL,           -- 'admin_ui' | 'agent_api' | 'system'
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  content_edits IS
  'Unified audit trail. Every write to a content surface (landing_pages.description_ar, programs.pitch_en, etc.) logs exactly one row. Human edits from admin UI AND agent edits via the Phase 1.5 API both land here.';
COMMENT ON COLUMN content_edits.editor_type IS
  '"human" → editor_id references profiles.id; "agent" → editor_id references agent_tokens.id.';
COMMENT ON COLUMN content_edits.change_kind IS
  '"scalar" (whole value replaced) | "rich_text_replaced" (TipTap JSON overwritten) | "rich_text_patched" (partial JSONB patch) | "jsonb_merged" (partial jsonb object merge).';

CREATE INDEX IF NOT EXISTS idx_content_edits_entity
  ON content_edits(entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_edits_editor
  ON content_edits(editor_type, editor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_edits_created_at
  ON content_edits(created_at DESC);

ALTER TABLE content_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_edits_admin_all ON content_edits;
CREATE POLICY content_edits_admin_all
  ON content_edits
  FOR ALL
  TO kunacademy_admin
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- GRANTs — app role needs SELECT on content_media (for future media picker)
-- ══════════════════════════════════════════════════════════════════════════

GRANT SELECT ON content_media TO kunacademy;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_media TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_tokens    TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_edits   TO kunacademy_admin;

-- Public (anon) role gets NOTHING. Image files are served by nginx static
-- (`/uploads/media/...`) outside Postgres.
