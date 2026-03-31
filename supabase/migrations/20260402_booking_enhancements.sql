-- ─────────────────────────────────────────────────────────
-- Wave 14 — Booking System Enhancements
-- 2026-04-02
-- ─────────────────────────────────────────────────────────

-- 1. Buffer time support on coach schedules
ALTER TABLE coach_schedules
  ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER DEFAULT 15;

-- 2. Slot holding — prevent overbooking on concurrent sessions
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS held_until TIMESTAMPTZ;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS held_by UUID REFERENCES auth.users(id);

-- 3. Performance index — availability queries scan by provider+time+status
CREATE INDEX IF NOT EXISTS idx_bookings_provider_time_status
  ON bookings(provider_id, start_time, status);

-- 4. Fix coach_time_off column naming (support date range in addition to single day)
--    start_date / end_date already exist from v2 schema — no change needed.
--    Add an index for fast time-off range lookups.
CREATE INDEX IF NOT EXISTS idx_coach_time_off_coach_dates
  ON coach_time_off(coach_id, start_date, end_date);
