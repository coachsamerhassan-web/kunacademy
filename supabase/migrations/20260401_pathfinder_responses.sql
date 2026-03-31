-- ============================================================================
-- Pathfinder Responses — stores completed assessment results for CRM follow-up
-- Wave 12: Pathfinder Engine Foundation
-- ============================================================================

CREATE TABLE IF NOT EXISTS pathfinder_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: anonymous users can take the assessment before signing up
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  -- individual = personal coaching path, corporate = organizational path
  type TEXT NOT NULL CHECK (type IN ('individual', 'corporate')),
  -- Full answer trail: [{question_id, answer_id, category_weights}]
  answers_json JSONB NOT NULL DEFAULT '[]',
  -- Scored recommendations: [{slug, category, match_pct, reasons}]
  recommendations JSONB NOT NULL DEFAULT '[]',
  -- Corporate path only: ROI calculator inputs
  roi_inputs JSONB,
  -- Journey stage assigned: explorer, seeker, practitioner, master
  journey_stage TEXT,
  -- Locale at time of assessment
  locale TEXT DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for CRM lookups by email
CREATE INDEX idx_pathfinder_responses_email ON pathfinder_responses(email);
-- Index for linking responses to users after signup
CREATE INDEX idx_pathfinder_responses_user_id ON pathfinder_responses(user_id);

-- RLS
ALTER TABLE pathfinder_responses ENABLE ROW LEVEL SECURITY;

-- Users can read their own responses
CREATE POLICY "Users can read own pathfinder responses"
  ON pathfinder_responses FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all responses
CREATE POLICY "Admins can read all pathfinder responses"
  ON pathfinder_responses FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Public insert (no auth required — assessment is open to visitors)
CREATE POLICY "Anyone can submit pathfinder response"
  ON pathfinder_responses FOR INSERT
  WITH CHECK (true);

-- Users can update their own (to link user_id after signup)
CREATE POLICY "Users can update own pathfinder responses"
  ON pathfinder_responses FOR UPDATE
  USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));
