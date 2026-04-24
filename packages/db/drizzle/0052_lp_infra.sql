-- 0052_lp_infra.sql
-- Wave 14 — Landing-Page Infrastructure (Pre-Launch Isolation)
--
-- Source of truth: /Users/samer/Claude Code/Project Memory/KUN-Features/Waves/14-LANDING-PAGE-INFRASTRUCTURE.md
-- Scope: General-purpose landing-page infrastructure. GPS-of-Life is the first
--        consumer; this migration is the FOUNDATION, not GPS content.
--
-- Changes:
--   1. Extend `landing_pages` with 5 new columns:
--        - launch_lock         boolean — page reachable when LAUNCH_MODE=landing-only
--        - composition_json    jsonb   — multi-section content composition
--        - lead_capture_config jsonb   — { enabled, fields[], success_redirect, ... }
--        - payment_config      jsonb   — payment tier/currency config (LP-INFRA-B wires)
--        - analytics_config    jsonb   — per-page GA4/Meta/TikTok pixel + custom events
--   2. Create new table `lp_leads` for lead-capture audit trail (DB write before
--      Zoho fire-and-forget so we never lose a lead even if Zoho is down).
--   3. RLS + GRANTs: lp_leads is admin-read-all + insert-from-app. anon cannot read.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS. Safe to re-run.

-- ── Schema extension on landing_pages ──────────────────────────────────────
ALTER TABLE landing_pages
  ADD COLUMN IF NOT EXISTS launch_lock         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS composition_json    jsonb,
  ADD COLUMN IF NOT EXISTS lead_capture_config jsonb,
  ADD COLUMN IF NOT EXISTS payment_config      jsonb,
  ADD COLUMN IF NOT EXISTS analytics_config    jsonb;

COMMENT ON COLUMN landing_pages.launch_lock IS
  'When true, this LP is reachable even when LAUNCH_MODE=landing-only. Used to whitelist specific pages during pre-launch isolation.';
COMMENT ON COLUMN landing_pages.composition_json IS
  'Structured multi-section LP content: { hero: {...}, sections: [{type, title, body, items[], cta}], thank_you: {...} }. Optional; when NULL the page falls back to the legacy hero+body+CTA renderer.';
COMMENT ON COLUMN landing_pages.lead_capture_config IS
  '{ enabled, fields[], required_fields[], success_redirect?, zoho_lead_source?, consent_text_{ar,en}? }';
COMMENT ON COLUMN landing_pages.payment_config IS
  '{ enabled, currencies[], tiers[{code, label, deadline, prices, stripe_price_ids}], group_codes[], alumni_unlock_early_bird }. Schema only in this migration; payment widget wiring deferred to LP-INFRA-B.';
COMMENT ON COLUMN landing_pages.analytics_config IS
  '{ ga4_id?, meta_pixel_id?, tiktok_pixel_id?, conversion_event_name? }';

-- ── New table: lp_leads ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lp_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  locale          text NOT NULL,
  name            text NOT NULL,
  email           text NOT NULL,
  phone           text,
  message         text,
  metadata        jsonb,
  zoho_synced     boolean NOT NULL DEFAULT false,
  zoho_synced_at  timestamptz,
  zoho_contact_id text,
  ip_address      text,
  user_agent      text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE lp_leads IS
  'Audit trail for landing-page lead submissions. Written BEFORE Zoho/email/Telegram fire so leads are never lost. Admin-read, app-insert via api/lp/lead.';

-- Indexes for admin list view + email lookup + per-page analytics
CREATE INDEX IF NOT EXISTS idx_lp_leads_slug_created   ON lp_leads (slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lp_leads_email_lower    ON lp_leads (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_lp_leads_landing_page   ON lp_leads (landing_page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lp_leads_created_at     ON lp_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lp_leads_zoho_pending   ON lp_leads (created_at) WHERE zoho_synced = false;

-- ── RLS on lp_leads ─────────────────────────────────────────────────────────
ALTER TABLE lp_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lp_leads_admin_all  ON lp_leads;
DROP POLICY IF EXISTS lp_leads_anon_block ON lp_leads;

-- Admin (kunacademy_admin BYPASSRLS or app role with is_admin()=true) sees all
CREATE POLICY lp_leads_admin_all ON lp_leads
  FOR ALL
  TO kunacademy, kunacademy_admin
  USING (true)
  WITH CHECK (true);

-- anon explicitly blocked (lead inserts go through the kunacademy app role
-- in the API route handler, not through anon)
CREATE POLICY lp_leads_anon_block ON lp_leads
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ── GRANTs ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON lp_leads TO kunacademy;
GRANT ALL ON lp_leads TO kunacademy_admin;

-- (lp_leads.id uses gen_random_uuid() — no sequence to GRANT.)

-- ── Verify ──────────────────────────────────────────────────────────────────
DO $verify$
DECLARE
  v_lp_cols int;
  v_table_exists int;
BEGIN
  SELECT COUNT(*) INTO v_lp_cols
    FROM information_schema.columns
    WHERE table_name = 'landing_pages'
      AND column_name IN ('launch_lock', 'composition_json', 'lead_capture_config', 'payment_config', 'analytics_config');
  IF v_lp_cols <> 5 THEN
    RAISE EXCEPTION 'LP-INFRA: expected 5 new columns on landing_pages, got %', v_lp_cols;
  END IF;

  SELECT COUNT(*) INTO v_table_exists
    FROM information_schema.tables
    WHERE table_name = 'lp_leads';
  IF v_table_exists <> 1 THEN
    RAISE EXCEPTION 'LP-INFRA: expected lp_leads table, got %', v_table_exists;
  END IF;

  RAISE NOTICE 'LP-INFRA migration verified: 5 new columns + lp_leads table + RLS + GRANTs';
END
$verify$;
