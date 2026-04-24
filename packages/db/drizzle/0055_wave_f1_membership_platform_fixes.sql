-- Migration 0055 — Wave F.1 post-DeepSeek QA fixes
--
-- Applied AFTER 0055_wave_f1_membership_platform.sql on same migration row.
-- This is a companion patch rolled into the same migration slot (hash updated).
--
-- Fixes:
--   [MEDIUM] memberships.user_id ON DELETE CASCADE → SET NULL
--     Rationale: preserve membership history for 3-year tax/dispute retention
--     per spec §10. Admin-driven profile deletion should not wipe audit trail.
--   [LOW] pricing_config.entity_key — add snake_case pattern CHECK
--     Tightens the existing `char_length BETWEEN 1 AND 64` check to reject
--     arbitrary strings.
--
-- Idempotent.

BEGIN;

-- ── 1. memberships.user_id: CASCADE → SET NULL ──────────────────────────────
-- Drop existing FK (it was added via inline REFERENCES in CREATE TABLE).
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'memberships'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%REFERENCES profiles%';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE memberships DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- Allow user_id to become NULL for historical rows after profile deletion.
ALTER TABLE memberships ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE memberships
  ADD CONSTRAINT memberships_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Partial unique index uses user_id — when user_id IS NULL (profile deleted),
-- the row is historical and outside the active-membership constraint anyway
-- (ended_at would also be set on any deleted-user membership). Unique index
-- is unaffected since NULLs never collide in a UNIQUE B-tree.

-- ── 2. pricing_config.entity_key: pattern CHECK ─────────────────────────────
-- Drop the loose length-only check and add tighter snake_case check.
DO $$
DECLARE
  ck_name text;
BEGIN
  SELECT conname INTO ck_name
  FROM pg_constraint
  WHERE conrelid = 'pricing_config'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%entity_key%BETWEEN%';
  IF ck_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pricing_config DROP CONSTRAINT %I', ck_name);
  END IF;
END $$;

ALTER TABLE pricing_config
  ADD CONSTRAINT pricing_config_entity_key_format
  CHECK (entity_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

COMMIT;
