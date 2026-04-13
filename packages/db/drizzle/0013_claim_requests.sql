-- 0013: Claim Requests — allows graduates to claim their community_members profile

CREATE TABLE IF NOT EXISTS claim_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
  email       text NOT NULL,
  message     text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);
CREATE INDEX IF NOT EXISTS idx_claim_requests_member ON claim_requests(member_id);

-- Rate limiting index: email + created_at for checking recent submissions
CREATE INDEX IF NOT EXISTS idx_claim_requests_email_created ON claim_requests(email, created_at DESC);

-- RLS: only admins can read/write via withAdminContext
ALTER TABLE claim_requests ENABLE ROW LEVEL SECURITY;

-- Admin role full access
GRANT ALL ON claim_requests TO kunacademy_admin;
