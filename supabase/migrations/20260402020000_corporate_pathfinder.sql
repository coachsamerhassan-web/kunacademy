-- ============================================================================
-- Corporate Pathfinder — extends pathfinder_responses for corporate use case
-- Wave 12: Benefits-Driven Pathfinder Feature
-- ============================================================================

-- Add corporate-specific columns to pathfinder_responses
ALTER TABLE pathfinder_responses
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS selected_benefits JSONB,
  ADD COLUMN IF NOT EXISTS self_assessment JSONB,
  ADD COLUMN IF NOT EXISTS custom_benefits TEXT[],
  ADD COLUMN IF NOT EXISTS proposal_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Custom benefit submissions for knowledge base improvement
CREATE TABLE IF NOT EXISTS custom_benefit_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathfinder_response_id UUID REFERENCES pathfinder_responses(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  benefit_text TEXT NOT NULL,
  company_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_benefits_direction ON custom_benefit_submissions(direction);

-- RLS
ALTER TABLE custom_benefit_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit custom benefits (via pathfinder)
CREATE POLICY "Public insert custom benefits" ON custom_benefit_submissions
  FOR INSERT WITH CHECK (true);

-- Only admins can read custom benefits
CREATE POLICY "Admins read custom benefits" ON custom_benefit_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
