-- Migration 0027: attendance unique index for ON CONFLICT upsert
-- Enables clean onConflictDoUpdate pattern in /api/lms/attendance/mark
-- Eliminates TOCTOU race on concurrent marks for same slot

-- PostgreSQL requires COALESCE for nullable column in UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS attendance_upsert_key
  ON attendance (enrollment_id, session_date, COALESCE(session_number, 0));

-- Note: attendance.session_number is nullable in schema. Rows with NULL
-- session_number collapse to slot 0 for upsert purposes. If your product
-- needs distinct NULL slots per day, revisit before using this index.
