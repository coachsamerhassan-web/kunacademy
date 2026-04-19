-- ============================================================================
-- Migration: 0016_zoho_crm_sync
-- Creates: crm_sync_state, crm_sync_queue
-- Purpose: Tracks per-user Zoho CRM sync state and queues failed/pending
--          records for idempotent retry.
-- Architecture: Hybrid sync (event-driven for new users + payments;
--               batch cron for status updates and backfill).
-- ============================================================================

BEGIN;

-- ── crm_sync_state ──────────────────────────────────────────────────────────
-- One row per KUN profile. Tracks Zoho CRM contact_id and sync metadata.
-- Unique on profile_id (enforces one CRM contact per KUN user).
CREATE TABLE IF NOT EXISTS crm_sync_state (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  zoho_contact_id   TEXT,                   -- NULL until first successful sync
  zoho_module       TEXT        NOT NULL DEFAULT 'Contacts',  -- 'Contacts' | 'Leads'
  activity_status   TEXT        NOT NULL DEFAULT 'New',       -- 'New' | 'Active' | 'Passive'
  last_synced_at    TIMESTAMP WITH TIME ZONE,
  sync_error        TEXT,                   -- last error message if sync failed
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_sync_state_profile_id_idx
  ON crm_sync_state (profile_id);

CREATE INDEX IF NOT EXISTS crm_sync_state_zoho_contact_id_idx
  ON crm_sync_state (zoho_contact_id)
  WHERE zoho_contact_id IS NOT NULL;

-- ── crm_sync_queue ───────────────────────────────────────────────────────────
-- Retry queue for failed CRM sync attempts and deal/note pushes.
-- Event-driven path writes here on failure; cron drains it.
CREATE TABLE IF NOT EXISTS crm_sync_queue (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  operation     TEXT        NOT NULL,   -- 'upsert_contact' | 'create_deal' | 'update_status'
  payload       JSONB       NOT NULL DEFAULT '{}',
  attempts      INT         NOT NULL DEFAULT 0,
  last_error    TEXT,
  scheduled_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_sync_queue_profile_id_idx
  ON crm_sync_queue (profile_id);

CREATE INDEX IF NOT EXISTS crm_sync_queue_scheduled_at_idx
  ON crm_sync_queue (scheduled_at)
  WHERE attempts < 5;

-- Grant privileges to kunacademy_admin role (used by withAdminContext)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kunacademy_admin') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON crm_sync_state TO kunacademy_admin;
    GRANT SELECT, INSERT, UPDATE, DELETE ON crm_sync_queue TO kunacademy_admin;
  END IF;
END $$;

COMMIT;
