CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by admin
CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id);
-- Index for querying by target
CREATE INDEX idx_audit_target ON admin_audit_log(target_type, target_id);
-- Index for date range queries
CREATE INDEX idx_audit_date ON admin_audit_log(created_at DESC);

-- RLS: Only admins can read audit logs, only service_role can write
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (is_admin());

-- No INSERT policy for authenticated users — writes go through service_role (admin client)
