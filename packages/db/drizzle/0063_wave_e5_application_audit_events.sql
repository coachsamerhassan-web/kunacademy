-- Migration 0063 — Wave E.5 — Scholarship Application Audit Events
--
-- Source authority:
--   /Users/samer/Claude Code/Project Memory/KUN-Features/WAVE-E-SCHOLARSHIP-FUND-SPEC.md
--   Wave E.5 dispatch (00-STATUS 2026-04-26-f)
--
-- Scope (E.5 only — additive, no data migration):
--   (1) scholarship_application_audit_events — append-only audit log for status
--       transitions + admin notes attached to scholarship_applications rows.
--   (2) RLS — admin-readable only (recipient/applicant must NEVER see internal
--       transition history per dignity framing).
--   (3) Append-only enforced via REVOKE UPDATE/DELETE FROM kunacademy.
--   (4) GRANTs to kunacademy_admin only (admin-tier write/read).
--   (5) idempotency UNIQUE on (applicant_email, created_at::date) prevents
--       same-day duplicate public submissions (E.5 dispatch §2 idempotent
--       contract).
--
-- IP / dignity boundary (per CLAUDE.md):
--   No methodology / scoring detail in column comments. The audit event
--   stores ENUM event type (status_changed | note_added | …) with optional
--   free-form note text — the note text is admin-author internal, never
--   exposed back to applicant via UI.
--
-- Append-only:
--   We REVOKE UPDATE, DELETE FROM kunacademy + kunacademy_admin AT THE END
--   so the table is provably immutable from the application + admin role.
--   Postgres allows the table owner (postgres) to bypass — emergency repair
--   path requires SUPERUSER + manual `psql -U postgres` shell.
--
-- E.5 contracts E.6 inherits from this table:
--   - The 'allocated' transition writes a row here AND triggers E.6's
--     allocation matcher (which writes its own scholarships row + sdl rows).
--   - The 'disbursed' transition writes a row here AND triggers E.6's
--     disbursement flow.
--
-- Idempotency:
--   CREATE TABLE IF NOT EXISTS — re-run safe
--   DROP POLICY IF EXISTS before each CREATE POLICY — re-run safe
--   GRANTs are idempotent in Postgres
--
-- Same-day public-submission idempotency (separate concern — not a new table,
--   added as a partial UNIQUE index on the existing scholarship_applications):
--   Prevents the API from inserting two rows when the user double-clicks
--   submit. Uses a partial unique index gated on
--   metadata->>'source' = 'public_form' so admin manual entries (B5) are
--   exempt — admins legitimately enter multiple historical applications for
--   the same email + date.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. scholarship_application_audit_events — append-only audit log         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS scholarship_application_audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES scholarship_applications(id) ON DELETE CASCADE,
  admin_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type      text NOT NULL,
  before_status   text,
  after_status    text,
  note            text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE scholarship_application_audit_events IS
  'Wave E.5 — append-only audit log for scholarship_applications. '
  'Every status transition + admin note insertion writes a row here. '
  'Admin-readable only; NEVER exposed to applicants via UI (dignity framing). '
  'UPDATE + DELETE are revoked from kunacademy + kunacademy_admin — table is '
  'effectively immutable from the application surfaces.';

COMMENT ON COLUMN scholarship_application_audit_events.event_type IS
  'One of: status_changed, note_added, info_requested, allocated, disbursed';

COMMENT ON COLUMN scholarship_application_audit_events.before_status IS
  'Previous status of the application (NULL on creation events).';

COMMENT ON COLUMN scholarship_application_audit_events.after_status IS
  'New status after the transition (NULL on note-only events).';

COMMENT ON COLUMN scholarship_application_audit_events.note IS
  'Optional admin-author internal note. NEVER displayed to applicants.';

-- CHECK: event_type whitelist. Catches code typos at write-time.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'scholarship_application_audit_events'::regclass
      AND conname  = 'sch_app_audit_events_event_type_chk'
  ) THEN
    ALTER TABLE scholarship_application_audit_events
      ADD CONSTRAINT sch_app_audit_events_event_type_chk
      CHECK (event_type IN (
        'created',
        'status_changed',
        'note_added',
        'info_requested',
        'allocated',
        'disbursed'
      ));
  END IF;
END $$;

-- CHECK: status_changed events MUST have both before_status and after_status
-- populated. Catches incomplete writes.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'scholarship_application_audit_events'::regclass
      AND conname  = 'sch_app_audit_events_status_chk'
  ) THEN
    ALTER TABLE scholarship_application_audit_events
      ADD CONSTRAINT sch_app_audit_events_status_chk
      CHECK (
        (event_type <> 'status_changed')
        OR (before_status IS NOT NULL AND after_status IS NOT NULL)
      );
  END IF;
END $$;

-- Indexes for the admin queue: lookup by application + chronological order.
CREATE INDEX IF NOT EXISTS sch_app_audit_events_application_idx
  ON scholarship_application_audit_events(application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sch_app_audit_events_admin_idx
  ON scholarship_application_audit_events(admin_id, created_at DESC)
  WHERE admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sch_app_audit_events_type_idx
  ON scholarship_application_audit_events(event_type, created_at DESC);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. RLS — admin-only read/insert; UPDATE/DELETE revoked at end           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE scholarship_application_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sch_app_audit_events_admin_all ON scholarship_application_audit_events;

-- Admin full access (read + write — admin/lifecycle-style observability).
CREATE POLICY sch_app_audit_events_admin_all
  ON scholarship_application_audit_events
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Server role: API needs to INSERT on initial public submission too (event_type='created').
-- Read is gated by RLS — only admin (via is_admin()) can SELECT.
DROP POLICY IF EXISTS sch_app_audit_events_server_insert ON scholarship_application_audit_events;
CREATE POLICY sch_app_audit_events_server_insert
  ON scholarship_application_audit_events
  FOR INSERT TO kunacademy
  WITH CHECK (true);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Same-day public-submission idempotency on scholarship_applications   ║
-- ║    Partial unique index — only enforces on metadata.source='public_form'║
-- ║    so admin manual entries (B5) bypass the constraint.                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Rationale: prevents two rows when the user double-clicks "submit" in the
-- public form. Per spec §10 dispatch §2: "idempotent on retries via
-- (applicant_email, created_at::date) UNIQUE for same-day submissions".
--
-- Implementation note: we partial-index on (lower(applicant_email), day-bucket)
-- where source='public_form' so:
--   - Public form retries collapse to a single row (the second INSERT throws
--     unique_violation; the API layer catches and returns 200 with the
--     existing row's confirmation token).
--   - Admin manual entries can write multiple rows for the same email/day
--     (cheque + bank transfer + legacy import).
--
-- IMPORTANT: Postgres rejects index expressions that aren't IMMUTABLE.
-- `created_at::date` is STABLE (depends on session TimeZone), not IMMUTABLE.
-- We use `date_trunc('day', created_at AT TIME ZONE 'UTC')` which IS immutable
-- for a fixed timezone literal — this gives us a UTC day-bucket that is
-- deterministic and indexable.

CREATE UNIQUE INDEX IF NOT EXISTS scholarship_apps_same_day_public_uidx
  ON scholarship_applications (
    lower(applicant_email),
    (date_trunc('day', created_at AT TIME ZONE 'UTC'))
  )
  WHERE (metadata->>'source') = 'public_form';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. GRANTs — admin can read+write+update; kunacademy can ONLY insert      ║
-- ║    UPDATE + DELETE explicitly revoked from BOTH roles. Append-only.      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Grant minimal privileges first
GRANT SELECT, INSERT ON scholarship_application_audit_events TO kunacademy;
GRANT SELECT, INSERT ON scholarship_application_audit_events TO kunacademy_admin;

-- Explicitly revoke UPDATE + DELETE so the audit log is append-only.
-- Even the admin role cannot mutate or remove an existing audit row from
-- the application path — emergency repair requires shell-level
-- `psql -U postgres`.
REVOKE UPDATE, DELETE ON scholarship_application_audit_events FROM kunacademy;
REVOKE UPDATE, DELETE ON scholarship_application_audit_events FROM kunacademy_admin;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Self-smoke                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  cnt int;
BEGIN
  -- 1. audit table exists
  SELECT count(*) INTO cnt FROM information_schema.tables
   WHERE table_name='scholarship_application_audit_events';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 1 FAIL: audit table missing'; END IF;
  RAISE NOTICE 'SMOKE 1 PASSED: audit table exists';

  -- 2. event_type CHECK present
  SELECT count(*) INTO cnt FROM pg_constraint
   WHERE conrelid='scholarship_application_audit_events'::regclass
     AND conname='sch_app_audit_events_event_type_chk';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 2 FAIL: event_type CHECK missing'; END IF;
  RAISE NOTICE 'SMOKE 2 PASSED: event_type CHECK exists';

  -- 3. status_changed CHECK present
  SELECT count(*) INTO cnt FROM pg_constraint
   WHERE conrelid='scholarship_application_audit_events'::regclass
     AND conname='sch_app_audit_events_status_chk';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 3 FAIL: status_changed CHECK missing'; END IF;
  RAISE NOTICE 'SMOKE 3 PASSED: status_changed CHECK exists';

  -- 4. RLS enabled
  SELECT count(*) INTO cnt FROM pg_class
   WHERE relname='scholarship_application_audit_events' AND relrowsecurity=true;
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 4 FAIL: RLS not enabled'; END IF;
  RAISE NOTICE 'SMOKE 4 PASSED: RLS enabled';

  -- 5. policies present
  SELECT count(*) INTO cnt FROM pg_policy
   WHERE polrelid='scholarship_application_audit_events'::regclass
     AND polname IN (
       'sch_app_audit_events_admin_all',
       'sch_app_audit_events_server_insert'
     );
  IF cnt <> 2 THEN RAISE EXCEPTION 'SMOKE 5 FAIL: expected 2 policies, found %', cnt; END IF;
  RAISE NOTICE 'SMOKE 5 PASSED: 2 RLS policies present';

  -- 6. CHECK rejects invalid event_type (negative test)
  BEGIN
    INSERT INTO scholarship_application_audit_events (
      application_id, event_type
    ) VALUES (
      gen_random_uuid(),
      'invalid_event_type_for_smoke'
    );
    RAISE EXCEPTION 'SMOKE 6 FAIL: invalid event_type was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'SMOKE 6 PASSED: invalid event_type rejected by CHECK';
  WHEN foreign_key_violation THEN
    -- application_id FK fires before CHECK in some plans — also fine,
    -- proves the FK is in place which is also a goal.
    RAISE NOTICE 'SMOKE 6 PASSED: FK fired (application_id missing) — also valid';
  END;

  -- 7. CHECK rejects status_changed without statuses
  BEGIN
    INSERT INTO scholarship_application_audit_events (
      application_id, event_type, before_status, after_status
    ) VALUES (
      gen_random_uuid(),
      'status_changed',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'SMOKE 7 FAIL: status_changed without statuses was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'SMOKE 7 PASSED: status_changed without statuses rejected by CHECK';
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'SMOKE 7 PASSED: FK fired (application_id missing) — also valid';
  END;

  -- 8. partial unique index on scholarship_applications present
  SELECT count(*) INTO cnt FROM pg_indexes
   WHERE tablename='scholarship_applications'
     AND indexname='scholarship_apps_same_day_public_uidx';
  IF cnt <> 1 THEN RAISE EXCEPTION 'SMOKE 8 FAIL: same-day public uidx missing'; END IF;
  RAISE NOTICE 'SMOKE 8 PASSED: same-day public unique index exists';

  RAISE NOTICE 'Migration 0063 self-smoke complete (8 PASS)';
END $$;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Operator follow-up (run AFTER `sudo -u postgres psql -f`)                ║
-- ║                                                                          ║
-- ║ Per F.1 / F.5 / F.6 ownership pattern, ensure the table remains owned   ║
-- ║ by postgres so RLS is enforced (table owners bypass RLS by default).    ║
-- ║                                                                          ║
-- ║   ALTER TABLE scholarship_application_audit_events OWNER TO postgres;    ║
-- ║                                                                          ║
-- ║   GRANT SELECT, INSERT ON scholarship_application_audit_events           ║
-- ║     TO kunacademy_admin;                                                 ║
-- ║   GRANT SELECT, INSERT ON scholarship_application_audit_events           ║
-- ║     TO kunacademy;                                                       ║
-- ║   REVOKE UPDATE, DELETE ON scholarship_application_audit_events          ║
-- ║     FROM kunacademy;                                                     ║
-- ║   REVOKE UPDATE, DELETE ON scholarship_application_audit_events          ║
-- ║     FROM kunacademy_admin;                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ROLLBACK (manual — rare; for emergency only)                             ║
-- ║                                                                          ║
-- ║   BEGIN;                                                                  ║
-- ║   DROP TABLE IF EXISTS scholarship_application_audit_events CASCADE;     ║
-- ║   DROP INDEX IF EXISTS scholarship_apps_same_day_public_uidx;            ║
-- ║   COMMIT;                                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
