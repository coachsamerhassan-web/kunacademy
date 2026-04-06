-- Wave 11 Phase 3 (cont.) — Add eligible_kun_levels to services + seed booking services
-- Prices in minor units (250 AED = 25000)

-- 1. Add eligible_kun_levels column so services can be filtered by coach level
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS eligible_kun_levels TEXT[] DEFAULT NULL;

COMMENT ON COLUMN services.eligible_kun_levels IS
  'Kun coach levels that can deliver this service. NULL = all levels. Values: basic, professional, expert, master';

-- 2. Add slug column for stable URL references
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Use a proper UNIQUE constraint (not partial index) so ON CONFLICT (slug) works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_services_slug'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT uq_services_slug UNIQUE (slug);
  END IF;
END $$;

-- 3. Upsert the 6 board-approved booking services
-- Using stable UUID slugs so re-runs are idempotent via slug match

-- Discovery Session (all bookable coaches)
INSERT INTO services (slug, name_ar, name_en, description_ar, description_en, duration_minutes, price_aed, price_egp, price_usd, eligible_kun_levels, is_active)
VALUES (
  'discovery',
  'جلسة استكشافية',
  'Discovery Session',
  'جلسة مجانية للتعرف على الكوتشينج ومناقشة ما تريد تحقيقه',
  'A free 20-minute session to explore coaching and discuss what you want to achieve',
  20, 0, 0, 0,
  ARRAY['basic','professional','expert','master'],
  true
)
ON CONFLICT (slug) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      description_ar = EXCLUDED.description_ar,
      description_en = EXCLUDED.description_en,
      duration_minutes = EXCLUDED.duration_minutes,
      price_aed = EXCLUDED.price_aed,
      eligible_kun_levels = EXCLUDED.eligible_kun_levels,
      is_active = EXCLUDED.is_active;

-- Individual Coaching — Basic (250 AED / 2500 EGP / 68 USD) in minor units
INSERT INTO services (slug, name_ar, name_en, description_ar, description_en, duration_minutes, price_aed, price_egp, price_usd, eligible_kun_levels, is_active)
VALUES (
  'individual-basic',
  'كوتشينج فردي',
  'Individual Coaching',
  'جلسة كوتشينج فردية ٦٠ دقيقة مع كوتش أساسي',
  '60-minute one-on-one coaching session with a basic-level coach',
  60, 25000, 250000, 6800,
  ARRAY['basic'],
  true
)
ON CONFLICT (slug) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      description_ar = EXCLUDED.description_ar,
      description_en = EXCLUDED.description_en,
      duration_minutes = EXCLUDED.duration_minutes,
      price_aed = EXCLUDED.price_aed,
      eligible_kun_levels = EXCLUDED.eligible_kun_levels,
      is_active = EXCLUDED.is_active;

-- Individual Coaching — Professional (400 AED / 4000 EGP / 109 USD) in minor units
INSERT INTO services (slug, name_ar, name_en, description_ar, description_en, duration_minutes, price_aed, price_egp, price_usd, eligible_kun_levels, is_active)
VALUES (
  'individual-professional',
  'كوتشينج فردي',
  'Individual Coaching',
  'جلسة كوتشينج فردية ٦٠ دقيقة مع كوتش محترف',
  '60-minute one-on-one coaching session with a professional-level coach',
  60, 40000, 400000, 10900,
  ARRAY['professional'],
  true
)
ON CONFLICT (slug) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      description_ar = EXCLUDED.description_ar,
      description_en = EXCLUDED.description_en,
      duration_minutes = EXCLUDED.duration_minutes,
      price_aed = EXCLUDED.price_aed,
      eligible_kun_levels = EXCLUDED.eligible_kun_levels,
      is_active = EXCLUDED.is_active;

-- Individual Coaching — Expert (600 AED / 6000 EGP / 163 USD) in minor units
INSERT INTO services (slug, name_ar, name_en, description_ar, description_en, duration_minutes, price_aed, price_egp, price_usd, eligible_kun_levels, is_active)
VALUES (
  'individual-expert',
  'كوتشينج فردي',
  'Individual Coaching',
  'جلسة كوتشينج فردية ٦٠ دقيقة مع كوتش خبير',
  '60-minute one-on-one coaching session with an expert-level coach',
  60, 60000, 600000, 16300,
  ARRAY['expert'],
  true
)
ON CONFLICT (slug) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      description_ar = EXCLUDED.description_ar,
      description_en = EXCLUDED.description_en,
      duration_minutes = EXCLUDED.duration_minutes,
      price_aed = EXCLUDED.price_aed,
      eligible_kun_levels = EXCLUDED.eligible_kun_levels,
      is_active = EXCLUDED.is_active;

-- Individual Coaching — Master (800 AED / 8000 EGP / 218 USD) in minor units
INSERT INTO services (slug, name_ar, name_en, description_ar, description_en, duration_minutes, price_aed, price_egp, price_usd, eligible_kun_levels, is_active)
VALUES (
  'individual-master',
  'كوتشينج فردي',
  'Individual Coaching',
  'جلسة كوتشينج فردية ٦٠ دقيقة مع كوتش ماستر',
  '60-minute one-on-one coaching session with a master-level coach',
  60, 80000, 800000, 21800,
  ARRAY['master'],
  true
)
ON CONFLICT (slug) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      description_ar = EXCLUDED.description_ar,
      description_en = EXCLUDED.description_en,
      duration_minutes = EXCLUDED.duration_minutes,
      price_aed = EXCLUDED.price_aed,
      eligible_kun_levels = EXCLUDED.eligible_kun_levels,
      is_active = EXCLUDED.is_active;

-- 3-Session Package — price_aed = 0 because it's computed per coach level (tier × 3 × 0.85)
-- eligible_kun_levels = all — available for all bookable coaches
-- sessions_count = 3
INSERT INTO services (slug, name_ar, name_en, description_ar, description_en, duration_minutes, price_aed, price_egp, price_usd, eligible_kun_levels, sessions_count, is_active)
VALUES (
  '3-session-package',
  'باقة ٣ جلسات',
  '3-Session Package',
  'ثلاث جلسات كوتشينج بخصم ١٥٪ — الأفضل لمن يريد تحولاً حقيقياً',
  'Three 60-minute coaching sessions at 15% discount — ideal for meaningful transformation',
  60, 0, 0, 0,
  ARRAY['basic','professional','expert','master'],
  3,
  true
)
ON CONFLICT (slug) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      description_ar = EXCLUDED.description_ar,
      description_en = EXCLUDED.description_en,
      duration_minutes = EXCLUDED.duration_minutes,
      price_aed = EXCLUDED.price_aed,
      eligible_kun_levels = EXCLUDED.eligible_kun_levels,
      sessions_count = EXCLUDED.sessions_count,
      is_active = EXCLUDED.is_active;
