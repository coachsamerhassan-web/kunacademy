-- Migration: Fix instructor schema drift — add columns that exist in Drizzle but not in DB
-- Date: 2026-04-12 (Wave S2 session 6)
-- Applied: VPS staging DB

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS kun_level TEXT,
  ADD COLUMN IF NOT EXISTS icf_credential TEXT,
  ADD COLUMN IF NOT EXISTS service_roles TEXT[];
