-- 0049_canon_w3a_ihya_gallery.sql
-- Canon W3-A — wire Shahira's Ihya gallery manifest into 6 Ihya program rows.
--
-- Source: /Users/samer/Claude Code/Workspace/CMO/output/2026-04-22-ihya-gallery-manifest.md (rev-0)
-- Scope:  Ihya only (ihya-body, ihya-reviving-the-self, ihya-impact,
--         ihya-innovation, ihya-connection, ihya-grand-journey).
--
-- Changes:
--   1. Extend `programs` with:
--        - gallery_json  jsonb  (array of {url, alt_ar, alt_en, aspect, caption_ar?, caption_en?})
--        - closing_bg_url text  (hero for the closing CTA band)
--   2. Populate hero_image_url (where empty), gallery_json, closing_bg_url
--      on the 6 Ihya slugs per manifest.
--
-- Assets already copied (via scripts/canon-w3a-ihya-assets.sh equivalent)
-- under /images/programs/ihya/ in apps/web/public.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE by slug.
-- Safe to re-run.

-- ── Schema extension ────────────────────────────────────────────────────────
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS gallery_json jsonb,
  ADD COLUMN IF NOT EXISTS closing_bg_url text;

COMMENT ON COLUMN programs.gallery_json IS
  'Array of gallery images: [{url, alt_ar, alt_en, aspect?, caption_ar?, caption_en?, cross_attrib?}]. Rendered as Gallery section on program detail page.';
COMMENT ON COLUMN programs.closing_bg_url IS
  'Background image for the closing CTA band. Track-color tinted per program.';

-- ── Seed: Ihya Body / إحياء الجسد ──────────────────────────────────────────
UPDATE programs SET
  hero_image_url = '/images/programs/ihya/bg-jun-ihya-retreat.png',
  closing_bg_url = '/images/programs/ihya/bg-carousel-burnout-cta.png',
  gallery_json = $$[
    {"url":"/images/programs/ihya/ihya-sinai-path-2023.jpeg","alt_ar":"إيقاع الأرض يُبطئ خطوك","alt_en":"The pace of the land slowing you down"},
    {"url":"/images/programs/ihya/ihya-desert-walking-path.jpg","alt_ar":"مسارٌ يُمشى بلا استعجال","alt_en":"A path walked without urgency"},
    {"url":"/images/programs/ihya/ihya-solo-walk-oasis.webp","alt_ar":"مشيٌ منفرد نحو ما يناديك","alt_en":"A solitary walk toward what calls you"},
    {"url":"/images/programs/ihya/ihya-body-stillness.png","alt_ar":"السكون الذي كان الجسدُ يطلبه","alt_en":"Stillness the body had been asking for"}
  ]$$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-body';

-- ── Seed: Ihya Reviving the Self / إحياء النفس ────────────────────────────
UPDATE programs SET
  hero_image_url = '/images/programs/ihya/ihya-reviving-the-self--02-mountain-arrival-aerial.png',
  closing_bg_url = '/images/programs/ihya/bg-carousel-burnout-cta.png',
  gallery_json = $$[
    {"url":"/images/programs/ihya/ihya-reviving-the-self--03-stone-terrace-circle.png","alt_ar":"حلقةٌ على تراسٍ حجريّ عند المغيب","alt_en":"A circle on a stone terrace at dusk"},
    {"url":"/images/programs/ihya/ihya-reviving-the-self--01-car-night-recognition.png","alt_ar":"الليلةُ التي سبقت الوصول — لحظة التعرّف","alt_en":"The night before the arrival — recognition"},
    {"url":"/images/programs/ihya/your-identity--02-water-basin-reflection.png","alt_ar":"ماءٌ، وما يعكسه الماء","alt_en":"Water, and what water reflects"},
    {"url":"/images/programs/ihya/somatic-thinking-intro--02-seated-meditation.png","alt_ar":"جلوسٌ في السكون","alt_en":"Seated stillness"}
  ]$$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-reviving-the-self';

-- ── Seed: Ihya Impact / إحياء الأثر (thin — 3 real + 2 fallbacks) ─────────
UPDATE programs SET
  hero_image_url = '/images/programs/ihya/bg-jun-ihya-retreat.png',
  closing_bg_url = '/images/programs/ihya/bg-carousel-burnout-cta.png',
  gallery_json = $$[
    {"url":"/images/programs/ihya/ihya-lantern-stone-path.jpg","alt_ar":"قنديلٌ على درب النيّة","alt_en":"A lantern on the path of intention","cross_attrib":true},
    {"url":"/images/programs/ihya/bg-carousel-burnout-cta.png","alt_ar":"الأفق حين يسكن العمل","alt_en":"The horizon after the work settles","cross_attrib":true}
  ]$$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-impact';

-- ── Seed: Ihya Innovation / روح الابتكار ──────────────────────────────────
UPDATE programs SET
  hero_image_url = '/images/programs/ihya/bg-jun-human-edge.png',
  closing_bg_url = '/images/programs/ihya/ihya-tree-glowing-roots.jpg',
  gallery_json = $$[
    {"url":"/images/programs/ihya/ihya-lantern-stone-path.jpg","alt_ar":"ضوءٌ على درب لم يكن مرئيّاً","alt_en":"Light on a previously-hidden path"},
    {"url":"/images/programs/ihya/ihya-idea-shape.jpeg","alt_ar":"شكل الفكرة قبل أن يكون لها كلمات","alt_en":"The shape of an idea before it has words"},
    {"url":"/images/programs/ihya/ihya-creative-stillness.webp","alt_ar":"السكون الإبداعيّ","alt_en":"Creative stillness"}
  ]$$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-innovation';

-- ── Seed: Ihya Connection / إحياء الصِّلة ─────────────────────────────────
UPDATE programs SET
  hero_image_url = '/images/programs/ihya/menhajak-leadership--02-rooftop-circle.png',
  closing_bg_url = '/images/programs/ihya/stce-level-3-stgc--01-coaching-circle.png',
  gallery_json = $$[
    {"url":"/images/programs/ihya/ihya-reviving-the-self--03-stone-terrace-circle.png","alt_ar":"حلقة إصغاء على الحجر","alt_en":"A circle of listening on stone","cross_attrib":true},
    {"url":"/images/programs/ihya/bg-story-90min-bts.png","alt_ar":"خلف الحوار — ما تحمله الحلقة","alt_en":"Behind the dialogue — what a circle holds"},
    {"url":"/images/programs/ihya/bg-w19-story-bts.png","alt_ar":"حيث يتعمّق الحديث","alt_en":"Where a conversation deepens"},
    {"url":"/images/programs/ihya/ihya-connection-faces-warmth.jpeg","alt_ar":"وجوهٌ في دفء الحضور","alt_en":"Faces in the warmth of presence"}
  ]$$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-connection';

-- ── Seed: Ihya Grand Journey / إحياء الرحلة الكبرى ────────────────────────
UPDATE programs SET
  hero_image_url = '/images/programs/ihya/bg-jun-ihya-retreat.png',
  closing_bg_url = '/images/programs/ihya/bg-jun-monthend.png',
  gallery_json = $$[
    {"url":"/images/programs/ihya/ihya-sinai-path-2023.jpeg","alt_ar":"إيقاع رحلةٍ لا يمكن استعجالها","alt_en":"The pace of a journey you can't rush","cross_attrib":true},
    {"url":"/images/programs/ihya/ihya-solo-walk-oasis.webp","alt_ar":"أثرُ خطواتٍ سبقتك","alt_en":"Footprints of those who walked before you","cross_attrib":true},
    {"url":"/images/programs/ihya/ihya-grand-journey-middle-day.png","alt_ar":"اليومُ الأوسط — حين تحملك الرحلة","alt_en":"The middle day — when the journey holds you"},
    {"url":"/images/programs/ihya/ihya-grand-journey-vista.png","alt_ar":"منظرٌ لا يُبلغ إلاّ مشياً","alt_en":"A vista earned by walking, not driving"}
  ]$$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-grand-journey';

-- Verify expected count — 6 rows updated. If fewer, caller should investigate.
DO $$
DECLARE
  row_count integer;
BEGIN
  SELECT count(*) INTO row_count
  FROM programs
  WHERE slug IN ('ihya-body','ihya-reviving-the-self','ihya-impact','ihya-innovation','ihya-connection','ihya-grand-journey')
    AND gallery_json IS NOT NULL;
  RAISE NOTICE 'Canon W3-A: % / 6 Ihya rows have gallery_json populated', row_count;
END $$;
