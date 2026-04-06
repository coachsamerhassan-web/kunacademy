-- Wave 11 Phase 3: Split coach_level into kun_level + icf_credential + service_roles
-- coach_level is KEPT for backward compatibility during migration.

-- Add new columns
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS kun_level TEXT
  CHECK (kun_level IN ('basic', 'professional', 'expert', 'master'));

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS icf_credential TEXT
  CHECK (icf_credential IN ('ACC', 'PCC', 'MCC'));

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS service_roles TEXT[];

-- Add comment explaining the split
COMMENT ON COLUMN instructors.coach_level IS 'DEPRECATED — use kun_level + icf_credential instead. Kept for backward compat.';
COMMENT ON COLUMN instructors.kun_level IS 'Kun internal coaching level (Samer assessment). Values: basic, professional, expert, master.';
COMMENT ON COLUMN instructors.icf_credential IS 'ICF external credential. Values: ACC, PCC, MCC.';
COMMENT ON COLUMN instructors.service_roles IS 'Special service roles beyond coaching. Values: mentor_coach, advanced_mentor.';
