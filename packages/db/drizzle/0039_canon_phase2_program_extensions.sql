-- Migration 0039: Canon Phase 2 — program schema extensions (Wave 1)
--
-- Foundation-only wave. No programs.json content changes; no rendered-page
-- behavior changes. Extends the programs table landed in 0036 so that
-- Canon Phase 2 Wave 2 content edits validate at the DB layer.
--
-- Two classes of change:
--   (1) Enum widening via refreshed CHECK constraints
--         nav_group gains 'family'
--         type      gains 'service'
--   (2) Eleven new nullable columns carrying canon-only concepts:
--         cross_list_nav_groups, delivery_formats, individually_bookable,
--         delivery_certification_required, grants_delivery_license,
--         concept_by, cta_type, durations_offered, pricing_by_duration,
--         track_color, delivery_notes
--
-- Idempotent. Non-destructive. Rollback = DROP the 11 columns + restore old
-- CHECKs (see `-- ROLLBACK` block at foot of file — not executed).
--
-- RLS + GRANTs already applied on the programs table in 0036; no further
-- RLS work needed (additive columns inherit the existing table-level policy).

BEGIN;

-- ── (1) Enum widening via refreshed CHECK constraints ──────────────────────
-- Postgres will not let us edit a CHECK in place. We drop the old constraint
-- (by name — matches 0036 implicit naming) and re-add with the expanded
-- value set. Wrapped in a transaction so we never leave the table in a
-- half-constrained state.

-- nav_group: was (certifications, courses, retreats, micro-courses, corporate, free, community)
--           now adds 'family'
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_nav_group_check;
ALTER TABLE programs ADD CONSTRAINT programs_nav_group_check
  CHECK (nav_group IN
    ('certifications','courses','retreats','micro-courses',
     'family','corporate','free','community'));

-- type: was (certification, diploma, recorded-course, live-course, retreat,
--            micro-course, workshop, free-resource)
--       now adds 'service'
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_type_check;
ALTER TABLE programs ADD CONSTRAINT programs_type_check
  CHECK (type IN
    ('certification','diploma','recorded-course','live-course',
     'retreat','micro-course','workshop','free-resource','service'));

-- ── (2) New columns (all nullable / default-safe) ──────────────────────────
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS cross_list_nav_groups          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delivery_formats               text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS individually_bookable          boolean,
  ADD COLUMN IF NOT EXISTS delivery_certification_required boolean,
  ADD COLUMN IF NOT EXISTS grants_delivery_license         text,
  ADD COLUMN IF NOT EXISTS concept_by                     text,
  ADD COLUMN IF NOT EXISTS cta_type                       text,
  ADD COLUMN IF NOT EXISTS durations_offered              jsonb,
  ADD COLUMN IF NOT EXISTS pricing_by_duration            jsonb,
  ADD COLUMN IF NOT EXISTS track_color                    text,
  ADD COLUMN IF NOT EXISTS delivery_notes                 text;

-- cta_type whitelist — enforced at the DB layer so no arbitrary CTA string
-- can leak into a rendered page even if the admin form / API validator is
-- bypassed. Additive to the API-layer validator in validateProgramBody.
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_cta_type_check;
ALTER TABLE programs ADD CONSTRAINT programs_cta_type_check
  CHECK (cta_type IS NULL OR cta_type IN
    ('enroll','request-proposal','register-interest','notify-me','contact'));

-- Each element of cross_list_nav_groups must itself be a valid nav_group.
-- Postgres has no native "array of enum values" CHECK, so we assert via
-- the <@ subset operator against the canonical list.
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_cross_list_nav_groups_check;
ALTER TABLE programs ADD CONSTRAINT programs_cross_list_nav_groups_check
  CHECK (
    cross_list_nav_groups <@ ARRAY[
      'certifications','courses','retreats','micro-courses',
      'family','corporate','free','community'
    ]::text[]
  );

-- Each element of delivery_formats must itself be a valid program_format.
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_delivery_formats_check;
ALTER TABLE programs ADD CONSTRAINT programs_delivery_formats_check
  CHECK (
    delivery_formats <@ ARRAY['online','in-person','hybrid']::text[]
  );

COMMIT;

-- ── ROLLBACK (manual, not auto-executed) ──────────────────────────────────
-- BEGIN;
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_cross_list_nav_groups_check;
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_delivery_formats_check;
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_cta_type_check;
--   ALTER TABLE programs
--     DROP COLUMN IF EXISTS delivery_notes,
--     DROP COLUMN IF EXISTS track_color,
--     DROP COLUMN IF EXISTS pricing_by_duration,
--     DROP COLUMN IF EXISTS durations_offered,
--     DROP COLUMN IF EXISTS cta_type,
--     DROP COLUMN IF EXISTS concept_by,
--     DROP COLUMN IF EXISTS grants_delivery_license,
--     DROP COLUMN IF EXISTS delivery_certification_required,
--     DROP COLUMN IF EXISTS individually_bookable,
--     DROP COLUMN IF EXISTS delivery_formats,
--     DROP COLUMN IF EXISTS cross_list_nav_groups;
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_nav_group_check;
--   ALTER TABLE programs ADD CONSTRAINT programs_nav_group_check
--     CHECK (nav_group IN ('certifications','courses','retreats','micro-courses',
--                          'corporate','free','community'));
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_type_check;
--   ALTER TABLE programs ADD CONSTRAINT programs_type_check
--     CHECK (type IN ('certification','diploma','recorded-course','live-course',
--                     'retreat','micro-course','workshop','free-resource'));
-- COMMIT;
