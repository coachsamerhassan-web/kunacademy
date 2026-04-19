-- Migration: 0014_mentoring_phase_1_4
-- Phase 1.4 — State Machine + Cron infrastructure
-- Adds:
--   1. second_try_deadline_at  column on package_instances
--   2. expiry_warn_metadata    column on package_instances (tracks which warning emails sent)
--   3. mentor_prep_released_at column on beneficiary_files (tracks 48h gate open)
--   4. assessment_sla_notified_at on package_instances (SLA check deduplication)
--   5. session_reminder_1h_sent_at on beneficiary_file_sessions (1h dedup flag)
-- All additions are nullable — no backfill needed.

-- ── package_instances additions ────────────────────────────────────────────

-- Deadline for second_try_pending: cron terminates after this date
ALTER TABLE package_instances
  ADD COLUMN IF NOT EXISTS second_try_deadline_at TIMESTAMPTZ;

-- JSON metadata for cron deduplication state.
-- Shape: { "expiry_warned_at": { "14": "ISO", "7": "ISO", "1": "ISO" }, "assessment_sla_notified_at": "ISO" }
ALTER TABLE package_instances
  ADD COLUMN IF NOT EXISTS cron_metadata JSONB NOT NULL DEFAULT '{}';

-- ── beneficiary_files additions ────────────────────────────────────────────

-- Timestamp when the 48h gate was opened and mentor was granted read access.
-- NULL = not yet released.
ALTER TABLE beneficiary_files
  ADD COLUMN IF NOT EXISTS mentor_prep_released_at TIMESTAMPTZ;

-- ── beneficiary_file_sessions additions ────────────────────────────────────

-- Deduplication flag for the 1-hour session reminder cron.
-- NULL = reminder not yet sent.
ALTER TABLE beneficiary_file_sessions
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMPTZ;

-- Same dedup flag for 24-hour reminder.
ALTER TABLE beneficiary_file_sessions
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;

-- Scheduled datetime for the session (used by reminder crons).
-- Existing rows have NULL — reminder crons skip rows with NULL scheduled_at.
ALTER TABLE beneficiary_file_sessions
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
