-- Migration 0048: Additive graduate-certificate migration for bare 'gps' slug retirement
--
-- Source authority: GPS-OF-LIFE-RESEARCH.md §1 lines 998-1002 (Samer approved 2026-04-21)
-- Companion: PATHFINDER-V7-TO-CANON-RECONCILIATION.md §2.2 (Samer signed 2026-04-22)
-- Bundled with: apps/web/src/lib/pathfinder-scorer.ts scorer edits (Phase 3.5)
--
-- Intent (from Hakima spec):
--   Preserve graduate-directory filter continuity after the bare 'gps' slug is
--   retired from the Pathfinder scorer priority list. Existing graduates tagged
--   'gps' should *additively* also carry the canonical 'gps-of-life' tag so
--   both the transitional UI filter ('gps') and the canonical filter
--   ('gps-of-life') return the same dataset.
--
-- Schema adaptation note:
--   The Hakima spec uses a 'graduates.tags[]' schema. This codebase instead
--   models graduate tagging as rows in 'graduate_certificates' keyed by
--   (member_id, program_slug, certificate_type) with UNIQUE constraint on that
--   tuple. The spec's array_append intent is preserved by inserting an additive
--   'gps-of-life' row for every graduate_certificates row that uses the bare
--   'gps' slug, without removing the original 'gps' row. ON CONFLICT DO NOTHING
--   makes the migration idempotent and re-runnable.
--
-- Ground-truth observation (VPS staging, verified 2026-04-22 pre-deploy):
--   SELECT DISTINCT program_slug FROM graduate_certificates WHERE program_slug = 'gps';
--   → 0 rows. The bare 'gps' slug has no graduate_certificates rows on staging.
--   So this migration is a documented no-op today. It is retained as a forward
--   guard: if any legacy data lands carrying program_slug='gps' (import, seed,
--   admin fixup), the companion 'gps-of-life' row is created automatically.
--
-- NOT in scope for this migration:
--   - Future sub-variant retagging (couples graduates → 'gps-couples', etc.)
--     remains a manual review by Samer + Nashit per GPS-OF-LIFE-RESEARCH §1 line 1004.
--   - UI filter arrays (graduate-directory.tsx line 113/133, api/graduates/route.ts
--     line 22) still reference 'gps' — dead filter today but harmless; Hakima
--     editorial follow-up will clean these when retagging lands.
--
-- Rollback:
--   DELETE FROM graduate_certificates
--   WHERE program_slug = 'gps-of-life'
--     AND certificate_type = 'completion'
--     AND (member_id, 'gps', certificate_type) IN (
--       SELECT member_id, 'gps', certificate_type
--       FROM graduate_certificates
--       WHERE program_slug = 'gps'
--     );

BEGIN;

-- Additive migration: for every graduate_certificates row tagged 'gps',
-- insert a mirror row tagged 'gps-of-life' (canonical slug). Idempotent via
-- the existing UNIQUE(member_id, program_slug, certificate_type) constraint.
INSERT INTO graduate_certificates (
  member_id,
  program_slug,
  program_name_ar,
  program_name_en,
  certificate_type,
  cohort_name,
  graduation_date,
  icf_credential,
  icf_credential_date,
  badge_slug,
  badge_label_ar,
  badge_label_en,
  verified
)
SELECT
  member_id,
  'gps-of-life'        AS program_slug,
  program_name_ar,
  program_name_en,
  certificate_type,
  cohort_name,
  graduation_date,
  icf_credential,
  icf_credential_date,
  badge_slug,
  badge_label_ar,
  badge_label_en,
  verified
FROM graduate_certificates
WHERE program_slug = 'gps'
  AND NOT EXISTS (
    SELECT 1 FROM graduate_certificates gc2
    WHERE gc2.member_id = graduate_certificates.member_id
      AND gc2.program_slug = 'gps-of-life'
      AND gc2.certificate_type = graduate_certificates.certificate_type
  );

COMMIT;
