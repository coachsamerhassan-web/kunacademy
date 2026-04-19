-- 0022: Performance hardening — indexes on admin_audit_log
-- Created: 2026-04-19

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_desc_idx ON admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_action_created_at_idx ON admin_audit_log (action, created_at DESC);

GRANT SELECT ON admin_audit_log TO kunacademy_admin;
GRANT SELECT ON admin_audit_log TO kunacademy;
