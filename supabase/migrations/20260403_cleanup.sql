-- Wave 16 Legacy Cleanup
-- Drop legacy availability table (replaced by coach_schedules in Wave 14)
DROP TABLE IF EXISTS availability CASCADE;
