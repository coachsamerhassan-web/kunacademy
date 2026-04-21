-- Migration 0041: CMS→DB Phase 3b — team coaches content seed
--
-- Seeds the 16 real coach rows from apps/web/data/cms/team.json into the
-- `instructors` table (13 published + 3 draft). Schema extended in 0032.
--
-- Idempotent: ON CONFLICT (slug) DO UPDATE replaces existing rows by slug.
-- Phase 2b test fixtures (test-mentor-manager, test-coach, test-attacker)
-- are DELETED up-front since they have null names and show on public /coaches.
-- They were seeded as 2b admin-flow fixtures; real content supersedes them.
--
-- profile_id stays NULL on every row — the auth-user-to-coach bridge is a
-- separate manual decision (d-coach-profile-id-bridge).
--
-- Data source: apps/web/data/cms/team.json @ commit f4abc77
-- Row count target: 16 (13 published+visible, 3 draft/hidden)

BEGIN;

-- ── Null out FKs from Phase 2b seed work (package_templates.created_by) ────
-- The 0041 migration deletes the 3 Phase 2b test instructor fixtures.
-- package_templates seed (stic-l1-mentoring-bundle-v1) was audit-stamped with
-- created_by = 'bbbb9999-0000-0000-0000-000000000009' (= test-mentor-manager).
-- Null the audit FK (non-critical) before the instructors DELETE so the
-- NO ACTION constraint doesn't abort the transaction.
UPDATE package_templates
   SET created_by = NULL
 WHERE created_by IN (
     SELECT id FROM instructors
      WHERE slug IN ('test-mentor-manager','test-coach','test-attacker')
   );

-- ── Clean up Phase 2b test fixtures (empty name rows) ───────────────────────
DELETE FROM instructors WHERE slug IN ('test-mentor-manager','test-coach','test-attacker');

-- ── Seed real coaches from team.json ───────────────────────────────────────
-- samer-hassan: Samer Hassan (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'samer-hassan',
  'مؤسس أكاديمية كُن — مبتكر التفكير الحسّي® — أول عربي MCC',
  'Founder of Kun Academy — Creator of Somatic Thinking® — ICF MCC',
  'سامر حسن',
  'Samer Hassan',
  'سامر حسن هو مبتكر منهجية التفكير الحسّي® وأول عربي يحصل على شهادة الكوتش المعتمد الماستر (MCC) من الاتحاد الدولي للكوتشينج (ICF). تدرّب على يديه أكثر من ٥٠٠ كوتش في ٤ قارات، وأجرى أكثر من ١٠٬٠٠٠ جلسة كوتشينج فردية. يقود أكاديمية كُن من دبي لتخريج كوتشز يحملون منهجية تبدأ من الجسد.',
  'Samer Hassan is the creator of Somatic Thinking® and the first Arab to earn the Master Certified Coach (MCC) credential from the International Coaching Federation (ICF). He has trained 500+ coaches across 4 continents and conducted 10,000+ individual coaching sessions. He leads Kun Academy from Dubai, graduating coaches who carry a methodology that begins with the body.',
  '/images/coaches/samer-hassan.jpg',
  'ICF MCC, ICF Young Leader Award 2019',
  'MCC',
  'MCC',
  ARRAY['التفكير الحسّي', 'القيادة', 'التحول المهني', 'Somatic Thinking', 'Leadership', 'Career Transition']::text[],
  ARRAY['التفكير الحسّي', 'Somatic Thinking']::text[],
  ARRAY['العربية', 'English', 'Italiano']::text[],
  true,
  true,
  true,
  1
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- marwa-sherif: Marwa Sherif (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'marwa-sherif',
  'كوتش PCC معتمد — شريك أكاديمية كُن',
  'ICF PCC Coach — Kun Academy Partner',
  'مروة شريف',
  'Marwa Sherif',
  'شريك تجاري في أكاديمية كُن ومدير الجودة. متخصصة في الكوتشينج الفردي والاستكشافي وإرشاد المتدربين.',
  'Business partner at Kun Academy and quality manager. Specializes in individual and exploratory coaching, and student mentoring.',
  '/images/coaches/marwa-sherif.webp',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية', 'English']::text[],
  true,
  true,
  true,
  2
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- shams-alabdali: Shams AlAbdali (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'shams-alabdali',
  'كوتش PCC معتمد — المملكة العربية السعودية',
  'ICF PCC Coach — Saudi Arabia',
  'شمس العبدلي',
  'Shams AlAbdali',
  NULL,
  NULL,
  '/images/coaches/shams-alabdali.webp',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية']::text[],
  true,
  true,
  true,
  3
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- yomna-elhatab: Yomna Elhatab (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'yomna-elhatab',
  'كوتش PCC معتمد — مصر',
  'ICF PCC Coach — Egypt',
  'يمنى الحطب',
  'Yomna Elhatab',
  NULL,
  NULL,
  '/images/coaches/yomna-elhatab.jpg',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية']::text[],
  true,
  true,
  true,
  4
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- marwa-abo-resha: Marwa Abo Resha (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'marwa-abo-resha',
  'كوتش PCC — دكتوراه الصحة النفسية — مديرة الإرشاد بكُن',
  'ICF PCC Coach — PhD Mental Health — Mentoring Director at Kun',
  'مروة أبو ريشة',
  'Marwa Abo Resha',
  'متخصصة في كوتشينج الصحة النفسية والعلاقات، مديرة الإرشاد في أكاديمية كُن، مُقيّمة ومُرشدة ICF، خبرة 14 عامًا.',
  'Mental health and relationships coach, mentoring director at Kun Academy, ICF mentor and assessor with 14 years of experience.',
  '/images/coaches/marwa-abo-resha.webp',
  'ICF PCC, PhD Mental Health, ICF Mentor Coach Assessor',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية', 'English']::text[],
  true,
  true,
  true,
  5
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- hussein-ali: Hussein Ali (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'hussein-ali',
  'كوتش PCC معتمد — منهجية التفكير الحسّي',
  'ICF PCC Coach — Somatic Thinking Methodology',
  'حسين علي',
  'Hussein Ali',
  'أكثر من 150 ساعة دراسة و500+ ساعة كوتشينج خلال 5 سنوات، متخصص في منهجية التفكير الحسّي.',
  '150+ study hours and 500+ coaching hours over 5 years, specializing in the Somatic Thinking methodology.',
  '/images/coaches/hussein-ali.webp',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  ARRAY['التفكير الحسّي', 'Somatic Thinking']::text[],
  ARRAY['العربية']::text[],
  true,
  true,
  true,
  6
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- khaled-alhaddad: Khaled Al Haddad (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'khaled-alhaddad',
  'كوتش PCC معتمد — المغرب',
  'ICF PCC Coach — Morocco',
  'خالد الحداد',
  'Khaled Al Haddad',
  NULL,
  NULL,
  '/images/coaches/khaled-alhaddad.webp',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية', 'Français']::text[],
  true,
  true,
  true,
  7
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- ragia-ezzat: Ragia Ezzat (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'ragia-ezzat',
  'كوتش PCC معتمد — مصر',
  'ICF PCC Coach — Egypt',
  'راجية عزت',
  'Ragia Ezzat',
  NULL,
  NULL,
  '/images/coaches/ragia-ezzat.jpg',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية', 'English']::text[],
  true,
  true,
  true,
  8
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- nahla-elghamrawy: Nahla Elghamrawy (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'nahla-elghamrawy',
  'كوتش PCC — مُرشدة ومُقيّمة ICF — 700+ ساعة كوتشينج',
  'ICF PCC Coach — Mentor Coach Assessor — 700+ Coaching Hours',
  'نهلة الغمراوي',
  'Nahla Elghamrawy',
  'أكثر من 700 ساعة كوتشينج و1000+ ساعة تدريب، مُرشدة ومُقيّمة معتمدة من ICF.',
  '700+ coaching hours and 1000+ training hours, ICF-certified mentor coach and assessor.',
  '/images/coaches/nahla-elghamrawy.jpg',
  'ICF PCC, Mentor Coach Assessor',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية', 'English']::text[],
  true,
  true,
  true,
  9
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- rawan-alsaidi: Rawan Alsaidi (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'rawan-alsaidi',
  'كوتش PCC معتمد — المملكة العربية السعودية',
  'ICF PCC Coach — Saudi Arabia',
  'روان السيدي',
  'Rawan Alsaidi',
  NULL,
  NULL,
  '/images/coaches/rawan-alsaidi.webp',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية']::text[],
  true,
  true,
  true,
  10
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- ghania-khogeer: Ghania Khogeer (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'ghania-khogeer',
  'كوتش ACC معتمد — المملكة العربية السعودية',
  'ICF ACC Coach — Saudi Arabia',
  'غانية خوجير',
  'Ghania Khogeer',
  NULL,
  NULL,
  '/images/coaches/ghania-khogeer.webp',
  'ICF ACC',
  'ACC',
  'ACC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية']::text[],
  true,
  true,
  true,
  11
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- yusra-bogis: Dr. Yusra Bogis (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'yusra-bogis',
  'كوتش حياة — دكتوراه تكنولوجيا التعليم',
  'Life Coach — PhD Education Technology',
  'د. يسرى بوقيس',
  'Dr. Yusra Bogis',
  'خبرة أكاديمية تمتد لـ20 عامًا، مستشارة في تصميم حقائب التدريب وتصميم الألعاب الأسرية.',
  '20 years of academic experience, consultant in training package design and family game design.',
  '/images/coaches/yusra-bogis.jpg',
  'PhD Education Technology, Life Coach',
  'ACC',
  'ACC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية']::text[],
  true,
  true,
  true,
  12
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- yusra-suliman: Yusra Suliman (pub=True)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'yusra-suliman',
  'كوتش ACC — متخصصة في كوتشينج الطلاق — MBA',
  'ICF ACC Coach — Divorce Coaching Specialist — MBA',
  'يسرى سليمان',
  'Yusra Suliman',
  'كوتشة سعودية تؤمن بأن التغيير الحقيقي يبدأ من الداخل. متخصصة في كوتشينج الطلاق وحل النزاعات البديل.',
  'Saudi coach who believes real change starts from within. Specializes in divorce coaching and alternative dispute resolution.',
  '/images/coaches/yusra-suliman.jpg',
  'MBA, DCA Divorce Coaching',
  'ACC',
  'ACC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية']::text[],
  true,
  true,
  true,
  13
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- mohammad-issa: Mohammed Issa (pub=False)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'mohammad-issa',
  'كوتش PCC معتمد',
  'ICF PCC Coach',
  'محمد عيسى',
  'Mohammed Issa',
  NULL,
  NULL,
  '/images/coaches/mohammad-issa.webp',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية']::text[],
  false,
  false,
  false,
  15
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- sara-samir: Sara Samir (pub=False)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'sara-samir',
  'كوتش PCC معتمد',
  'ICF PCC Coach',
  'سارة سامر',
  'Sara Samir',
  NULL,
  NULL,
  '/images/coaches/sara-samir.webp',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية']::text[],
  false,
  false,
  false,
  16
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- khalid-albusaisi: Khaled Albusasee (pub=False)
INSERT INTO instructors (
  slug, title_ar, title_en, name_ar, name_en, bio_ar, bio_en,
  photo_url, credentials, coach_level_legacy, icf_credential,
  specialties, coaching_styles, languages,
  is_visible, is_bookable, published, display_order
) VALUES (
  'khalid-albusaisi',
  'كوتش PCC معتمد',
  'ICF PCC Coach',
  'خالد البساسي',
  'Khaled Albusasee',
  NULL,
  NULL,
  '/images/coaches/khalid-albusaisi.webp',
  'ICF PCC',
  'PCC',
  'PCC',
  '{}'::text[],
  '{}'::text[],
  ARRAY['العربية']::text[],
  false,
  false,
  false,
  17
)
ON CONFLICT (slug) DO UPDATE SET
  title_ar           = EXCLUDED.title_ar,
  title_en           = EXCLUDED.title_en,
  name_ar            = EXCLUDED.name_ar,
  name_en            = EXCLUDED.name_en,
  bio_ar             = EXCLUDED.bio_ar,
  bio_en             = EXCLUDED.bio_en,
  photo_url          = EXCLUDED.photo_url,
  credentials        = EXCLUDED.credentials,
  coach_level_legacy = EXCLUDED.coach_level_legacy,
  icf_credential     = EXCLUDED.icf_credential,
  specialties        = EXCLUDED.specialties,
  coaching_styles    = EXCLUDED.coaching_styles,
  languages          = EXCLUDED.languages,
  is_visible         = EXCLUDED.is_visible,
  is_bookable        = EXCLUDED.is_bookable,
  published          = EXCLUDED.published,
  display_order      = EXCLUDED.display_order,
  last_edited_at     = now();

-- ── Verification (safe to leave in migration) ───────────────────────────────
DO $$
DECLARE v_total int; v_pub int;
BEGIN
  SELECT count(*) INTO v_total FROM instructors;
  SELECT count(*) INTO v_pub   FROM instructors WHERE published AND is_visible;
  RAISE NOTICE 'instructors total=% published_visible=%', v_total, v_pub;
  IF v_total < 16 THEN
    RAISE EXCEPTION 'Expected >=16 instructors, got %', v_total;
  END IF;
  IF v_pub < 13 THEN
    RAISE EXCEPTION 'Expected >=13 published+visible instructors, got %', v_pub;
  END IF;
END $$;

COMMIT;
