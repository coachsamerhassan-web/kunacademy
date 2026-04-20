-- 0023: lesson_syllabus hardening — add lesson_id FK + timestamps + indexes (pre-S5)
-- Pattern: add audit columns + FK constraint + query indexes for Wave S5 LMS

ALTER TABLE lesson_syllabus ADD COLUMN IF NOT EXISTS lesson_id UUID;

ALTER TABLE lesson_syllabus ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE lesson_syllabus ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE lesson_syllabus
  ADD CONSTRAINT lesson_syllabus_lesson_id_fkey
  FOREIGN KEY (lesson_id)
  REFERENCES lessons(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS lesson_syllabus_lesson_id_idx ON lesson_syllabus (lesson_id);
CREATE INDEX IF NOT EXISTS lesson_syllabus_course_id_idx ON lesson_syllabus (course_id);
CREATE INDEX IF NOT EXISTS lesson_syllabus_section_id_idx ON lesson_syllabus (section_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_syllabus TO kunacademy, kunacademy_admin;
