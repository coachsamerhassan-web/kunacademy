BEGIN;

-- Fix: Wave 2 column-level REVOKE on coach_level_legacy_do_not_use was a no-op
-- because 'authenticated' and 'anon' held a blanket table-level SELECT grant.
-- Column-level REVOKE does not override a prior table-level GRANT in Postgres.
-- Caught by Wave 4 Attacker suite — silent RLS bypass of legacy column.
--
-- Fix: drop the blanket grant, re-grant SELECT on an explicit safe-column allowlist.
-- The legacy column (coach_level_legacy_do_not_use) is intentionally EXCLUDED
-- and must never be re-added to this allowlist.
--
-- Authoritative allowlist discovered from live VPS via information_schema.column_privileges
-- (queried 2026-04-14 after Wave 4 fix was applied).
-- Note: 'anon' received 19 columns; 'authenticated' received 18 (title_en absent — matches live state).

REVOKE SELECT ON instructors FROM authenticated, anon;

GRANT SELECT (
  bio_ar,
  bio_en,
  coaching_styles,
  credentials,
  development_types,
  display_order,
  icf_credential,
  id,
  is_platform_coach,
  is_visible,
  kun_level,
  photo_url,
  pricing_json,
  profile_id,
  service_roles,
  slug,
  specialties,
  title_ar,
  title_en
) ON instructors TO anon;

GRANT SELECT (
  bio_ar,
  bio_en,
  coaching_styles,
  credentials,
  development_types,
  display_order,
  icf_credential,
  id,
  is_platform_coach,
  is_visible,
  kun_level,
  photo_url,
  pricing_json,
  profile_id,
  service_roles,
  slug,
  specialties,
  title_ar
) ON instructors TO authenticated;

COMMIT;
