-- 0023: Convert lesson_syllabus from VIEW to TABLE (S5 prep)
-- Idempotent: safe to re-run. Preserves currently-visible data.

DO $$
BEGIN
  -- If it's currently a VIEW, drop and recreate as TABLE with same-shape data
  IF EXISTS (SELECT 1 FROM information_schema.views
             WHERE table_schema='public' AND table_name='lesson_syllabus') THEN

    -- Snapshot the current view data before dropping
    CREATE TEMP TABLE _lesson_syllabus_snapshot AS
      SELECT * FROM lesson_syllabus;

    DROP VIEW lesson_syllabus CASCADE;

    CREATE TABLE lesson_syllabus (
      id              uuid PRIMARY KEY,
      lesson_id       uuid REFERENCES lessons(id) ON DELETE CASCADE,
      course_id       uuid,
      section_id      uuid,
      title_ar        text,
      title_en        text,
      "order"         integer,
      duration_minutes integer,
      is_preview      boolean,
      description_ar  text,
      description_en  text,
      created_at      timestamptz NOT NULL DEFAULT NOW(),
      updated_at      timestamptz NOT NULL DEFAULT NOW()
    );

    -- Seed from snapshot (view row's `id` becomes both `id` and `lesson_id`
    -- since the view was SELECT l.id FROM lessons l ...)
    INSERT INTO lesson_syllabus (id, lesson_id, course_id, section_id,
                                  title_ar, title_en, "order", duration_minutes,
                                  is_preview, description_ar, description_en)
    SELECT id, id AS lesson_id, course_id, section_id, title_ar, title_en,
           "order", duration_minutes, is_preview, description_ar, description_en
    FROM _lesson_syllabus_snapshot;

  -- If it doesn't exist at all, create a fresh empty table
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name='lesson_syllabus'
                    AND table_type='BASE TABLE') THEN
    CREATE TABLE lesson_syllabus (
      id              uuid PRIMARY KEY,
      lesson_id       uuid REFERENCES lessons(id) ON DELETE CASCADE,
      course_id       uuid,
      section_id      uuid,
      title_ar        text,
      title_en        text,
      "order"         integer,
      duration_minutes integer,
      is_preview      boolean,
      description_ar  text,
      description_en  text,
      created_at      timestamptz NOT NULL DEFAULT NOW(),
      updated_at      timestamptz NOT NULL DEFAULT NOW()
    );
  END IF;

  -- If it's already a table, add missing columns idempotently
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='lesson_syllabus'
             AND table_type='BASE TABLE') THEN
    -- Ensure lesson_id column + FK exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='lesson_syllabus'
                   AND column_name='lesson_id') THEN
      ALTER TABLE lesson_syllabus ADD COLUMN lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE;
    END IF;
    -- Ensure timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='lesson_syllabus'
                   AND column_name='created_at') THEN
      ALTER TABLE lesson_syllabus ADD COLUMN created_at timestamptz NOT NULL DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='lesson_syllabus'
                   AND column_name='updated_at') THEN
      ALTER TABLE lesson_syllabus ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW();
    END IF;
  END IF;
END
$$;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS lesson_syllabus_lesson_id_idx ON lesson_syllabus(lesson_id);
CREATE INDEX IF NOT EXISTS lesson_syllabus_course_id_idx ON lesson_syllabus(course_id);
CREATE INDEX IF NOT EXISTS lesson_syllabus_section_id_idx ON lesson_syllabus(section_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_syllabus TO kunacademy, kunacademy_admin;
