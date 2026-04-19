-- Migration 0021: Durable email outbox for crash-safe transactional email delivery
-- Pattern: transactional outbox — rows inserted in the SAME tx as business logic,
-- drained by a cron that calls the actual email provider.

CREATE TABLE IF NOT EXISTS email_outbox (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key    TEXT        NOT NULL,           -- 'assessment-result' | 'recording-received' | 'assessor-assignment'
  to_email        TEXT        NOT NULL,
  payload         JSONB       NOT NULL,           -- template params (student_name, locale, etc.)
  status          TEXT        NOT NULL DEFAULT 'pending',  -- 'pending' | 'sent' | 'failed'
  attempts        INT         NOT NULL DEFAULT 0,
  last_error      TEXT,
  last_attempt_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);

-- Partial index on pending rows — cron only scans this small slice
CREATE INDEX IF NOT EXISTS email_outbox_pending_idx
  ON email_outbox (status, created_at)
  WHERE status = 'pending';

-- App role + admin role access
GRANT SELECT, INSERT, UPDATE, DELETE ON email_outbox TO kunacademy, kunacademy_admin;
