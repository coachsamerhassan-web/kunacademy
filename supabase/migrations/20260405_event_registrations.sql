-- Event Registration — tracks who registered for which event
-- Events themselves are CMS-driven (Google Sheets); this table stores registrations only.

CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: guest registration before signup
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Event slug from CMS (not FK — events live in Google Sheets)
  event_slug TEXT NOT NULL,
  -- Contact info (captured at registration time)
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  -- Status: registered (free), pending_payment (paid), confirmed (paid+done), cancelled
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'pending_payment', 'confirmed', 'cancelled')),
  -- For paid events: reference to payments table
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  -- Number of seats reserved (usually 1)
  seats INTEGER DEFAULT 1,
  -- Notes from registrant (optional)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_event_reg_slug ON event_registrations(event_slug);
CREATE INDEX idx_event_reg_email ON event_registrations(email);
CREATE INDEX idx_event_reg_user ON event_registrations(user_id);

-- RLS
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can register (public insert — like pathfinder)
CREATE POLICY "Anyone can register for events"
  ON event_registrations FOR INSERT
  WITH CHECK (true);

-- Users can read own registrations
CREATE POLICY "Users can read own event registrations"
  ON event_registrations FOR SELECT
  USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Users can cancel own registrations
CREATE POLICY "Users can cancel own event registrations"
  ON event_registrations FOR UPDATE
  USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Admins can read all
CREATE POLICY "Admins can read all event registrations"
  ON event_registrations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins can update all
CREATE POLICY "Admins can update all event registrations"
  ON event_registrations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
