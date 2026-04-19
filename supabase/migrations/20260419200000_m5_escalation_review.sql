-- M5 Escalation Review — second_opinion_requested_at + override columns
-- Migration: 20260419200000_m5_escalation_review.sql

ALTER TABLE package_assessments
  ADD COLUMN IF NOT EXISTS second_opinion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES profiles(id);

-- Grant to app roles
GRANT SELECT, UPDATE ON package_assessments TO kunacademy;
GRANT SELECT, UPDATE ON package_assessments TO kunacademy_admin;
