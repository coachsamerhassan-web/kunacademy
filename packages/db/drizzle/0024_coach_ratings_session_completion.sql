-- 0024: Coach Ratings — session completion signal + rating linkage
-- Wave S9: Coach marks session completed → client receives rating prompt
-- Created: 2026-04-20

-- ── bookings: session completion columns ─────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS session_completed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_completed_by      UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS session_completion_notes  TEXT;

-- ── coach_ratings: booking linkage + timestamp ────────────────────────────────
-- booking_id already exists in Drizzle schema but may not be in DB yet.
-- rated_at makes ordering possible without relying on created_at semantics.
ALTER TABLE coach_ratings
  ADD COLUMN IF NOT EXISTS rated_at  TIMESTAMPTZ DEFAULT NOW();

-- Unique constraint: one rating per booking (prevents double-submit).
-- Use DO block to guard against re-runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_ratings_booking_id_key'
  ) THEN
    ALTER TABLE coach_ratings
      ADD CONSTRAINT coach_ratings_booking_id_key UNIQUE (booking_id);
  END IF;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS coach_ratings_coach_id_idx
  ON coach_ratings (coach_id);

CREATE INDEX IF NOT EXISTS bookings_session_completed_at_idx
  ON bookings (session_completed_at)
  WHERE session_completed_at IS NOT NULL;

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON bookings        TO kunacademy;
GRANT SELECT, INSERT, UPDATE ON bookings        TO kunacademy_admin;
GRANT SELECT, INSERT, UPDATE ON coach_ratings   TO kunacademy;
GRANT SELECT, INSERT, UPDATE ON coach_ratings   TO kunacademy_admin;
