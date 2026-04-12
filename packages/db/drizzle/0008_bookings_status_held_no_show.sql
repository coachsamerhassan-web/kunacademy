-- Migration: Expand bookings status check to include 'held' and 'no_show'
-- Date: 2026-04-12 (Wave S2 session 6)
-- The hold route uses 'held' for optimistic booking locks, and the coach portal
-- uses 'no_show' for sessions where the client didn't attend.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status = ANY (ARRAY['held', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show']));
