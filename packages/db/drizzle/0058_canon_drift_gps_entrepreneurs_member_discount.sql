-- 0058_canon_drift_gps_entrepreneurs_member_discount.sql
-- Canon drift fix per Canon Phase 2 decision F-W4 (resolved 2026-04-24).
--
-- Source of truth:
--   - DECISIONS-LEDGER.md d-canon-phase2-fw2-fw10 — "F-W4: STFC + entrepreneurs-6hr
--     NOT 10% member-discount eligible"
--   - PROGRAM-CANON.md v3 — Amin's CANON-PHASE2-AMIN-PRICING.md reflects this
--     (Associate-tier 1:1 is the only tier that gets the 10% member discount
--     on per-session level; big programs outside this exclusion list are
--     member-discount-eligible)
--   - Confirmed via CLAUDE.md rule: PROGRAM-CANON.md + downstream DB surfaces
--     must align; any divergence is drift to correct.
--
-- Context:
--   - Migration 0053 (canon seed, 2026-04-24) seeded programs with Phase 2
--     flags; `gps-entrepreneurs.member_discount_eligible` was set TRUE per
--     Part 1 §4 of PROGRAM-CANON.md at that time.
--   - Canon Phase 2 decision F-W4 later refined this: the 10% member discount
--     is excluded for STFC + entrepreneurs-6hr. STFC (stce-level-5-stfc) was
--     already FALSE in the seed (craft-product certification exclusion). The
--     entrepreneurs exclusion was NOT propagated.
--   - Live-probe 2026-04-25 confirmed drift:
--       gps-entrepreneurs.member_discount_eligible = TRUE (drift, must be FALSE)
--       stce-level-5-stfc.member_discount_eligible = FALSE (already aligned)
--
-- Scope:
--   - ONE row UPDATE. gps-entrepreneurs is a single DB row covering both 3hr
--     and 6hr cells; the F-W4 exclusion applies to the entrepreneurs slug as
--     a whole (per Amin's pricing canon, the member-discount toggle is a
--     program-level flag, not a per-cell flag). Realigning to FALSE.
--
-- Rollback: set member_discount_eligible = TRUE on gps-entrepreneurs.

UPDATE programs
SET member_discount_eligible = FALSE
WHERE slug = 'gps-entrepreneurs';
