-- Migration 0040: Canon Phase 2 Wave 2 — content seed (15 canon programs)
--
-- Replaces JSON-era programs.json content edits. Since Phase 3 PARTIAL
-- (2026-04-21) deleted programs.json and flipped DbContentProvider to
-- DB-only, content for the 15 canon programs lands via this seed.
--
-- Source of truth: /Users/samer/Claude Code/Project Memory/KUN-Features/PROGRAM-CANON.md
-- Every string in this file is taken verbatim from that canon (card-level
-- public-safe short descriptions, subtitles, titles, CTAs, track colors).
-- No session counts, no beat structure, no exercise prompts, no recipes.
-- Day-count durations (retreats) are PUBLIC per canon IP rule.
--
-- Idempotent. INSERT … ON CONFLICT (slug) DO UPDATE for the 10 new rows,
-- UPDATE for the 4 existing (gps-of-life, gps-accelerator, gps-professional
-- (renamed to gps-couples), ihya-reviving-the-self, stce-level-5-stfc),
-- DELETE for the duplicate `gps` slug.
--
-- Every row uses canon schema:
--   type values ∈ {workshop, service, retreat, certification}
--   nav_group values ∈ {courses, family, retreats, certifications}
--   cta_type values ∈ {enroll, request-proposal, register-interest}
--   published=true; next_start_date / price_* left NULL where canon says TBD.
--
-- Rollback: restore previous row states via the archive in
-- Workspace/CTO/output/2026-04-21-cms-json-archive/programs.json.

BEGIN;

-- ── (1) DELETE duplicate `gps` row (staging-only, no 301) ──────────────────
-- Canon Part 1 §1 + Part 4 item #9. Old placeholder slug retired cleanly.
DELETE FROM programs WHERE slug = 'gps';

-- ── (2) RENAME gps-professional → gps-couples (row #9) ─────────────────────
-- In-place slug update preserves id + FK integrity (landing_pages.program_id).
-- Then subsequent UPDATE loads canon content onto the renamed row.
UPDATE programs SET slug = 'gps-couples' WHERE slug = 'gps-professional';

-- ── (3) UPDATE gps-of-life (row #1) ────────────────────────────────────────
UPDATE programs SET
  title_ar          = 'GPS الحياة',
  title_en          = 'GPS of Life',
  subtitle_ar       = 'بوصلتك الداخلية لاتّجاه الحياة',
  subtitle_en       = 'Your Inner Compass for Life Direction',
  description_ar    = 'لستَ ضائعاً — خارطتُك كبرت عليك. مساحةٌ لتجلس مع نفسك قبل الـ "نعم" القادمة، وتسمع ما يقوله داخلك قبل ما يقوله من حولك.',
  description_en    = 'You are not lost — you''ve outgrown your map. A space to sit with yourself before the next "yes," and hear what your inside is saying before the voices around you.',
  nav_group         = 'courses',
  type              = 'workshop',
  cta_type          = 'enroll',
  track_color       = '#1A2340',
  published         = true,
  updated_at        = NOW()
WHERE slug = 'gps-of-life';

-- ── (4) UPDATE gps-accelerator (row #7) ────────────────────────────────────
UPDATE programs SET
  title_ar          = 'GPS — مسار الطلاب والشباب',
  title_en          = 'GPS — Students & Young Adults',
  subtitle_ar       = 'بوصلة القرار قبل القرار',
  subtitle_en       = 'The Compass Before the Decision',
  description_ar    = 'قبل القرار — تعرّف على الذي سيقرّر. في زمنٍ تتبدّل فيه المهن أسرع ممّا نسمّيها، السؤال لم يعد "ماذا أدرس؟" — بل "من أنا حين أقرّر؟"',
  description_en    = 'Before the decision — meet the one who will make it. In a time when careers reshape faster than we can name them, the question is no longer "what should I study?" — it is "who am I when I decide?"',
  nav_group         = 'courses',
  type              = 'workshop',
  cta_type          = 'enroll',
  track_color       = '#1A2340',
  published         = true,
  updated_at        = NOW()
WHERE slug = 'gps-accelerator';

-- ── (5) UPDATE gps-couples (renamed from gps-professional, row #9) ─────────
UPDATE programs SET
  title_ar          = 'GPS — مسار الأزواج والعائلات',
  title_en          = 'GPS — Couples & Families',
  subtitle_ar       = 'بوصلتان، اتّجاه واحد',
  subtitle_en       = 'Two Compasses, One Direction',
  description_ar    = 'لستُما تعبانَين من بعضكما. تعبانَين من الحياة. وهذه مساحةٌ لتعودا إلى بعضكما من هنا — اتّجاهٌ مشترك لا تسويةٌ متفاوَض عليها.',
  description_en    = 'You are not tired of each other. You are tired from life. And this is a space to return to each other from here — a shared direction, not a negotiated compromise.',
  nav_group         = 'courses',
  type              = 'workshop',
  cta_type          = 'enroll',
  track_color       = '#1A2340',
  published         = true,
  updated_at        = NOW()
WHERE slug = 'gps-couples';

-- ── (6) INSERT gps-entrepreneurs (row #12 — NEW) ───────────────────────────
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, track_color, published, is_featured, display_order
) VALUES (
  'gps-entrepreneurs',
  'GPS — مسار الرياديين والقادة',
  'GPS — Entrepreneurs & Leaders',
  'بوصلة المشروع، بوصلة القائد',
  'The Venture''s Compass, The Leader''s Compass',
  'قُدْ من مكانٍ لا يفرغ. بنيتَ شيئاً عظيماً — وربّما فقدتَ نفسك في مكانٍ ما داخله. هذه مساحةٌ لإيجادها، لا لإضافة طبقةٍ أخرى من المهامّ.',
  'Lead from a place that does not empty. You built something great — and somewhere inside it, you may have lost yourself. This is a space to find that self, not a space that adds another layer of tasks to your load.',
  'courses', 'workshop', 'online',
  'enroll', '#1A2340', true, false, 100
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  cta_type = EXCLUDED.cta_type,
  track_color = EXCLUDED.track_color,
  updated_at = NOW();

-- ── (7) INSERT wisal (row #16 — NEW service) ───────────────────────────────
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, cross_list_nav_groups, published, is_featured, display_order,
  is_icf_accredited
) VALUES (
  'wisal',
  'وِصال',
  'Wisal',
  'كوتشينج الأسر والأزواج',
  'Family & Couples Coaching',
  'للأسر التي تعيش توتراً، أو صمتاً، أو فجوة بين الأجيال. وِصال يخفّف التوتر، ويفتح مساحة حوار آمن يُحَسّ قبل أن يُقال، ويُشارك في صياغة ميثاق الأسرة.',
  'For families living with tension, silence, or generational gaps. Wisal reduces tension, opens safe communication, and co-creates a Family Charter.',
  'family', 'service', 'hybrid',
  'request-proposal', ARRAY[]::text[], true, true, 10,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  nav_group = EXCLUDED.nav_group,
  type = EXCLUDED.type,
  cta_type = EXCLUDED.cta_type,
  is_icf_accredited = EXCLUDED.is_icf_accredited,
  updated_at = NOW();

-- ── (8) INSERT seeds-youth (row #34 — NEW service, school-delivered) ───────
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, cross_list_nav_groups, delivery_formats,
  individually_bookable, published, is_featured, display_order
) VALUES (
  'seeds-youth',
  'بذور — الشباب',
  'Seeds — Youth',
  'برنامج قيادي للأطفال والمراهقين يُقدَّم عبر المدارس',
  'Leadership program for children and teens delivered via schools',
  'برنامج قيادي للأطفال والمراهقين يبني التوازن العاطفي ومهارات التواصل والوعي الاجتماعي. يُقدَّم للفئات العمرية ٨–١٠، ١١–١٣، ١٤–١٦ سنة، بصيغتين: داخل المدرسة، أو كخلوة/مخيم خارجي.',
  'A leadership program for children and teens building emotional balance, communication, and social awareness. Three age bands (8-10, 11-13, 14-16), delivered as in-school programming or offsite retreat.',
  'corporate', 'service', 'hybrid',
  'request-proposal', ARRAY['family']::text[], ARRAY['in-person','hybrid']::text[],
  false, true, false, 20
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  nav_group = EXCLUDED.nav_group,
  type = EXCLUDED.type,
  cta_type = EXCLUDED.cta_type,
  cross_list_nav_groups = EXCLUDED.cross_list_nav_groups,
  delivery_formats = EXCLUDED.delivery_formats,
  individually_bookable = EXCLUDED.individually_bookable,
  updated_at = NOW();

-- ── (9) INSERT seeds-parents (row #40 — NEW service, individually bookable) ─
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, cross_list_nav_groups, delivery_formats,
  individually_bookable, delivery_certification_required,
  published, is_featured, display_order
) VALUES (
  'seeds-parents',
  'بذور — الأهل (١٠١)',
  'Seeds — Parents (101)',
  'ورشة تأسيسية للأهل والمربّين',
  'Foundational workshop for parents and caretakers',
  'ورشة تأسيسية للأهل والمربّين والمعلّمين — تبني القدرة على دعم الأطفال والمراهقين بحضور أكمل، إصغاءٍ أعمق، وتواصلٍ أكثر أثراً. تُقدَّم غالباً بالتوازي مع برنامج بذور للشباب، ويمكن حجزها أيضاً كورشة مستقلة.',
  'A foundational workshop for parents, caretakers, and teachers — building the capacity to support children and teens with fuller presence, deeper listening, and more impactful communication. Typically delivered alongside Seeds Youth, also available as a standalone parent workshop.',
  'corporate', 'service', 'hybrid',
  'request-proposal', ARRAY['family']::text[], ARRAY['in-person','hybrid']::text[],
  true, false,
  true, false, 30
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  nav_group = EXCLUDED.nav_group,
  type = EXCLUDED.type,
  cta_type = EXCLUDED.cta_type,
  cross_list_nav_groups = EXCLUDED.cross_list_nav_groups,
  delivery_formats = EXCLUDED.delivery_formats,
  individually_bookable = EXCLUDED.individually_bookable,
  delivery_certification_required = EXCLUDED.delivery_certification_required,
  updated_at = NOW();

-- ── (10) INSERT seeds-caregivers (row #44 — NEW delivery-license tier) ─────
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, cross_list_nav_groups,
  individually_bookable, grants_delivery_license,
  published, is_featured, display_order,
  prerequisite_codes
) VALUES (
  'seeds-caregivers',
  'بذور — مقدّمو الرعاية',
  'Seeds — Caregivers',
  'مقدّمو الرعاية',
  'Caregivers',
  'تدريب متقدّم للمعلّمين والمربّين وكل من يريد أن يكون رفيقاً حقيقياً للأطفال والمراهقين على طريقهم. خرّيجو هذا المستوى يحصلون على صلاحية تقديم ورشة «بذور — الأهل (١٠١)» داخل مدارسهم ومؤسساتهم ومجتمعاتهم.',
  'Advanced training for teachers, caretakers, and anyone who wants to be a genuine companion to children and teens on their path. Graduates are authorized to deliver Seeds — Parents (101) within their own schools, organizations, and communities.',
  'corporate', 'service', 'hybrid',
  'request-proposal', ARRAY['family','certifications']::text[],
  true, 'seeds-parents',
  true, false, 40,
  ARRAY['seeds-parents']::text[]
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  nav_group = EXCLUDED.nav_group,
  type = EXCLUDED.type,
  cta_type = EXCLUDED.cta_type,
  cross_list_nav_groups = EXCLUDED.cross_list_nav_groups,
  individually_bookable = EXCLUDED.individually_bookable,
  grants_delivery_license = EXCLUDED.grants_delivery_license,
  prerequisite_codes = EXCLUDED.prerequisite_codes,
  updated_at = NOW();

-- ── (11) UPDATE ihya-reviving-the-self (rows #53, #54) ─────────────────────
-- Subtitle drift fix + canon CTA. Long-form copy stays as-is until
-- Shahira/Hakima 10-section composition sweep lands.
UPDATE programs SET
  subtitle_ar       = 'تهذيب الداخل وتصفية العادات المرهقة لاستعادة السكينة',
  subtitle_en       = 'Refining the interior and clearing exhausting habits to reclaim stillness',
  cta_type          = 'enroll',
  track_color       = '#2D6A6A',
  published         = true,
  updated_at        = NOW()
WHERE slug = 'ihya-reviving-the-self';

-- ── (12) INSERT ihya-body (row #10 — NEW gated retreat) ────────────────────
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, track_color, concept_by,
  next_start_date, published, is_featured, display_order,
  program_logo
) VALUES (
  'ihya-body',
  'إحياء الجسد',
  'Ihya — Reviving the Body',
  'أعد الاتصال بجسدك... لتسمع نفسك من جديد',
  'Reconnect with your body so you can hear yourself again',
  'أربعة أيام نعود فيها إلى الجسد كبيت أوّل — نصغي إلى ما يقوله قبل أن نطلب منه العمل. تعيد إحياء الجسد الاتصال بما اعتدنا تجاوزه: التعب الذي لم نسمح له بالراحة، الفرح الذي لم نمنحه صوتاً، الحكمة التي كانت هناك دائماً.',
  'Four days returning to the body as first home — listening to what it says before asking it to work. Reviving the Body restores the connection with what we''ve trained ourselves to override: the tiredness never allowed to rest, the joy never given voice, the wisdom that was always there.',
  'retreats', 'retreat', 'in-person',
  'register-interest', '#D97B59', 'samer-hassan',
  NULL, true, false, 210,
  '/images/programs/logos/ihya-body.png'
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  cta_type = EXCLUDED.cta_type,
  track_color = EXCLUDED.track_color,
  concept_by = EXCLUDED.concept_by,
  updated_at = NOW();

-- ── (13) INSERT ihya-impact (row #11 — NEW gated retreat) ──────────────────
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, track_color, concept_by,
  next_start_date, published, is_featured, display_order,
  program_logo
) VALUES (
  'ihya-impact',
  'إحياء الأثر',
  'Ihya — Reviving Impact',
  'وصل العمل بالنية وتحويل الجهد إلى أثرٍ صالح ومتّزن',
  'Align effort with intention and turn work into balanced, lasting impact',
  'ثلاثة أيام نفصل فيها بين الإنجاز والأثر. الكثير من نجاحنا يأكلنا، لأنّه لم يُبنَ على نيّة نعرفها. هنا نعود إلى السؤال الأقدم: ما الذي أريد أن يبقى منّي بعدي؟ ونفحص الفجوة بين الجهد الذي نبذله والأثر الذي نريد تركه.',
  'Three days to separate achievement from impact. Much of our success consumes us because it was never built on an intention we knew. Here we return to the oldest question: what do I want to remain of me after me? And we examine the gap between the effort we spend and the impact we want to leave.',
  'retreats', 'retreat', 'in-person',
  'register-interest', '#A16B47', 'samer-hassan',
  NULL, true, false, 220,
  '/images/programs/logos/ihya-impact.png'
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  cta_type = EXCLUDED.cta_type,
  track_color = EXCLUDED.track_color,
  concept_by = EXCLUDED.concept_by,
  updated_at = NOW();

-- ── (14) INSERT ihya-innovation (row #12 — NEW gated retreat) ──────────────
-- Canon AR register: `روح الابتكار` (Samer's deliberate asymmetry). Slug
-- stays `ihya-innovation` for family grouping.
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, track_color, concept_by,
  next_start_date, published, is_featured, display_order,
  program_logo
) VALUES (
  'ihya-innovation',
  'روح الابتكار',
  'Ihya — Reviving Innovation',
  'إطلاق الإبداع من الخوف وتجريب التفكير الحسّي',
  'Free creativity from fear and experiment with Somatic Thinking',
  'ثلاثة أيام للإبداع الذي لا يخشى الخطأ. معظم ما نسمّيه «حُكْماً نقدياً» هو خوف قديم ارتدى ثوب العقلانية. هنا نتعلّم أن الابتكار مهارة جسدية — لا فكرية — تنمو حين نتوقّف عن معاقبة أنفسنا قبل أن نجرّب.',
  'Three days for creativity that doesn''t fear the mistake. Most of what we call "critical judgment" is an old fear wearing the garment of reason. Here we learn that innovation is a somatic skill — not an intellectual one — that grows when we stop punishing ourselves before we experiment.',
  'retreats', 'retreat', 'in-person',
  'register-interest', '#E3A857', 'samer-hassan',
  NULL, true, false, 230,
  '/images/programs/logos/ihya-innovation.png'
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  cta_type = EXCLUDED.cta_type,
  track_color = EXCLUDED.track_color,
  concept_by = EXCLUDED.concept_by,
  updated_at = NOW();

-- ── (15) INSERT ihya-connection (row #13 — NEW gated retreat) ──────────────
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, track_color, concept_by,
  next_start_date, published, is_featured, display_order,
  program_logo
) VALUES (
  'ihya-connection',
  'إحياء الصِّلة',
  'Ihya — Reviving Connection',
  'تعلّم فنّ التواصل وبناء العلاقات من الوعي لا الحاجة',
  'Learn the art of communication and building relationships from awareness, not need',
  'ثلاثة أيام لإعادة النظر في علاقاتنا من جذرها. الصِّلة الحقيقية لا تُبنى من الحاجة — تُبنى من وعي بمن نحن حين لا نطلب. هنا نتدرّب على اللقاء الذي يحترم المسافة ويحترم القرب في آنٍ واحد.',
  'Three days to re-examine our relationships from the root. True connection isn''t built from need — it''s built from awareness of who we are when we aren''t asking. Here we practice the meeting that honors distance and closeness at the same time.',
  'retreats', 'retreat', 'in-person',
  'register-interest', '#6C8FA1', 'samer-hassan',
  NULL, true, false, 240,
  '/images/programs/logos/ihya-connection.png'
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  cta_type = EXCLUDED.cta_type,
  track_color = EXCLUDED.track_color,
  concept_by = EXCLUDED.concept_by,
  updated_at = NOW();

-- ── (16) INSERT ihya-grand-journey (row #14 — NEW 7-day flagship) ──────────
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en, nav_group, type, format,
  cta_type, track_color, concept_by,
  next_start_date, published, is_featured, display_order,
  program_logo
) VALUES (
  'ihya-grand-journey',
  'إحياء الرحلة الكبرى',
  'Ihya — The Grand Journey',
  'تجربة تكاملية في الطبيعة تجمع الجسد والنفس والعلاقات والعمل في انسجام',
  'An integrative experience in nature bringing body, soul, relationships, and work into harmony',
  'سبعة أيام في الطبيعة — الرحلة التي تجمع ما فرّقته الحياة. البدن، النفس، العلاقات، والعمل لم يُخلقوا ليعيشوا منفصلين، لكنّنا تعلّمنا عزلهم. هذه الرحلة الكبرى إعادة ترتيب — لا إعادة بناء — للانسجام الذي كان هناك قبل أن نجهله.',
  'Seven days in nature — the journey that gathers what life has scattered. Body, soul, relationships, and work weren''t made to live apart, but we learned to separate them. This Grand Journey is a re-ordering — not a re-building — of the harmony that was there before we forgot it.',
  'retreats', 'retreat', 'in-person',
  'register-interest', '#7A8C5D', 'samer-hassan',
  NULL, true, true, 200,
  '/images/programs/logos/ihya-grand-journey.png'
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_en = EXCLUDED.title_en,
  subtitle_ar = EXCLUDED.subtitle_ar,
  subtitle_en = EXCLUDED.subtitle_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  cta_type = EXCLUDED.cta_type,
  track_color = EXCLUDED.track_color,
  concept_by = EXCLUDED.concept_by,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- ── (17) UPDATE stce-level-5-stfc description (row #66) ────────────────────
-- Append Wisal-network sentence per canon. Existing description kept, canon
-- clause added to end (idempotent — safe to re-run).
UPDATE programs SET
  subtitle_ar       = 'المستوى الخامس',
  subtitle_en       = 'Level 5',
  description_ar    = 'كيف تقود كوتشينج الأزواج والعائلات عبر منهجية التفكير الحسّي؟ ٢٠ ساعة تبني هذه القدرة المتقدّمة، وتؤهّلك للانضمام إلى شبكة مقدّمي خدمة وِصال.',
  description_en    = 'How do you coach couples and families through Somatic Thinking? 20 hours building this advanced capability — and qualifying you to join the Wisal delivery network.',
  cta_type          = 'enroll',
  published         = true,
  updated_at        = NOW()
WHERE slug = 'stce-level-5-stfc';

COMMIT;

-- ── Post-migration verification queries (run separately, not executed here) ─
--   SELECT slug, type, nav_group, cta_type FROM programs
--     WHERE slug IN ('gps','gps-of-life','gps-accelerator','gps-professional',
--                    'gps-couples','gps-entrepreneurs','wisal',
--                    'seeds-youth','seeds-parents','seeds-caregivers',
--                    'ihya-reviving-the-self','ihya-body','ihya-impact',
--                    'ihya-innovation','ihya-connection','ihya-grand-journey',
--                    'stce-level-5-stfc')
--     ORDER BY display_order;
--   Expected: 16 rows (gps duplicate GONE), all canon types + cta_types.
