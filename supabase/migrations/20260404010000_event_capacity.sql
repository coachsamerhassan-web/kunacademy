-- Event Capacity + Waitlist
-- Events are CMS-driven (Google Sheets); capacity is a CMS field passed from the frontend.
-- No capacity column needed on event_registrations — capacity is checked server-side by
-- counting existing registrations for the slug and comparing against the CMS value.

-- Waitlist table: captures overflow registrations when an event is full
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  -- Set when admin sends the "spot available" notification
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX idx_waitlist_slug  ON waitlist_entries(event_slug);
CREATE INDEX idx_waitlist_email ON waitlist_entries(email);

-- RLS
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Anyone can join the waitlist (public insert)
CREATE POLICY "Anyone can join event waitlist"
  ON waitlist_entries FOR INSERT
  WITH CHECK (true);

-- Users can read their own waitlist entries (matched by email)
CREATE POLICY "Users can read own waitlist entries"
  ON waitlist_entries FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Admins can read all waitlist entries
CREATE POLICY "Admins can read all waitlist entries"
  ON waitlist_entries FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins can update waitlist entries (e.g. set notified_at)
CREATE POLICY "Admins can update waitlist entries"
  ON waitlist_entries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
