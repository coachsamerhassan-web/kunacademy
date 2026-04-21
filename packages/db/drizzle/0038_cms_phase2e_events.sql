-- Migration 0038: CMS→DB Phase 2e — events
--
-- Replaces the CMS `events` sheet / JSON (apps/web/data/cms/events.json).
-- One DB row per event slug.
--
-- Schema matches the existing CMS `Event` type surface (packages/cms/src/types.ts)
-- so DbContentProvider can round-trip without field renames:
--   slug, title_*, description_*, date_start, date_end, location_*, location_type,
--   capacity, price_aed/egp/usd, image_url, promo_video_url, program_slug,
--   registration_url, status, speaker_slugs[], registration_deadline,
--   is_featured, display_order, published.
--
-- Notes:
--   - date_start/date_end stay as `date` (day-resolution; matches JSON source).
--     Consumers already render them with new Date(ev.date_start + 'T00:00:00').
--   - program_slug is loose text (matches CMS pattern; programs.slug is authoritative).
--   - event_registrations.event_slug already loose text — unchanged.
--
-- Idempotent (IF NOT EXISTS everywhere). RLS: anon-read-published, admin-all.

-- ── events table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     text NOT NULL UNIQUE,

  -- Bilingual identity
  title_ar                 text NOT NULL,
  title_en                 text NOT NULL,
  description_ar           text,
  description_en           text,

  -- Dates (day resolution — matches CMS JSON shape)
  date_start               date NOT NULL,
  date_end                 date,

  -- Location
  location_ar              text,
  location_en              text,
  location_type            text NOT NULL DEFAULT 'online'
                           CHECK (location_type IN ('in-person','online','hybrid')),

  -- Capacity + pricing (TheaterPricing subset — Events sheet is AED/EGP/USD only)
  capacity                 integer,
  price_aed                numeric(10, 2) NOT NULL DEFAULT 0,
  price_egp                numeric(10, 2) NOT NULL DEFAULT 0,
  price_usd                numeric(10, 2) NOT NULL DEFAULT 0,

  -- Visual
  image_url                text,
  promo_video_url          text,

  -- Cross-refs (loose — programs.slug / instructors.slug CMS pattern)
  program_slug             text,
  speaker_slugs            text[] NOT NULL DEFAULT '{}',

  -- Registration
  registration_url         text,
  registration_deadline    date,
  status                   text NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','sold_out','completed')),

  -- Flags + ordering
  is_featured              boolean NOT NULL DEFAULT false,
  display_order            integer NOT NULL DEFAULT 0,

  -- Lifecycle
  published                boolean NOT NULL DEFAULT true,
  published_at             timestamptz,
  last_edited_by           uuid REFERENCES profiles(id),
  last_edited_at           timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_uidx         ON events (slug);
CREATE INDEX        IF NOT EXISTS events_date_start_idx    ON events (date_start);
CREATE INDEX        IF NOT EXISTS events_published_idx     ON events (published);
CREATE INDEX        IF NOT EXISTS events_program_slug_idx  ON events (program_slug) WHERE program_slug IS NOT NULL;
CREATE INDEX        IF NOT EXISTS events_status_idx        ON events (status);
CREATE INDEX        IF NOT EXISTS events_display_order_idx ON events (display_order);
CREATE INDEX        IF NOT EXISTS events_is_featured_idx   ON events (is_featured) WHERE is_featured = true;

-- ── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION events_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_touch_updated_at ON events;
CREATE TRIGGER events_touch_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION events_touch_updated_at();

-- ── GRANTs ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO kunacademy, kunacademy_admin;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_published_read ON events;
CREATE POLICY events_published_read
  ON events FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS events_admin_all ON events;
CREATE POLICY events_admin_all
  ON events FOR ALL
  USING (is_admin());
