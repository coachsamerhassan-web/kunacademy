-- Migration 0053: Canon Seed micro-wave — 8 new programs + flag extensions
--
-- Source authority:
--   /Users/samer/Claude Code/Project Memory/KUN-Features/PROGRAM-CANON.md (v3, 2026-04-24)
--   §16-§23 define the 8 new programs (3 self-paced + 4 coach tiers + 1 Samer-1on1)
--   §D.4 + §M define the member_discount_eligible + scholarship_eligible flags
--   /Users/samer/Claude Code/Project Memory/KUN-Features/CANON-PHASE2-HAKIMA-SLUGS.md
--   §A.4 + §B.6 specify the schema changes (types, enums, new columns)
--
-- Three classes of change:
--   (1) Enum widening via refreshed CHECK constraints
--         nav_group gains 'membership', 'coaching'
--         type      gains 'membership_gated', 'coaching-1on1'
--   (2) Eleven new nullable columns for Canon Phase 2 commerce/membership:
--         member_discount_eligible, scholarship_eligible,
--         membership_tier_required, coach_tier, booking_mode,
--         available_packages, total_content_hours, typical_completion_weeks,
--         lifetime_access_while_member, includes_coach_checkin,
--         application_only
--   (3) Data: 8 program rows (1 UPDATE-in-place + 7 INSERTs) + flag UPDATEs on
--         existing GPS/Wisal/Seeds/Ihya/STFC rows per §D.4
--
-- Idempotency contract:
--   - All ALTERs use DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT (re-runnable)
--   - All ADD COLUMNs use IF NOT EXISTS (re-runnable)
--   - INSERTs use ON CONFLICT (slug) DO UPDATE (re-runnable)
--   - UPDATEs are deterministic (fixed slug WHERE clause)
--
-- RLS / GRANTs:
--   Additive columns inherit the programs table-level policy set in 0036
--   (programs_admin_all via is_admin() + programs_published_read).
--   Existing GRANTs to kunacademy + kunacademy_admin cover new columns.
--   No new policies required.
--
-- Content IP boundary (per CLAUDE.md IP-protection rule):
--   Every string in this seed is card-level public-safe — subtitles, short
--   descriptions, CTAs, content-hour bands. No beat sequences, no recipe
--   language, no session structure. Per §16-§23 "IP boundary" clauses.
--
-- Notes on existing data:
--   - 'somatic-thinking-intro' already exists as type='recorded-course',
--     nav_group='certifications' from the earlier catalog. This migration
--     transforms it in-place to the canon shape: type='membership_gated',
--     nav_group='membership', membership_tier_required='free'. The row id is
--     preserved; any inbound FK from landing_pages survives.
--   - Arabic tier-1 label uses `كوتش` per §F.2 Samer override 2026-04-24
--     (NOT `مساعد`). English = `Associate` per H1=a.
--   - coaching-1on1-master = canon tier 3 (experienced, PCC, 6–10y).
--     coaching-1on1-expert = canon tier 4 (senior, MCC, 10y+, Kun-selected).
--     This is a canon rename from the earlier agreements-doc where tier 3
--     was `Expert` and tier 4 was `Master`. The slugs now match the final
--     canonical order: Associate → Professional → Master → Expert.
--
-- Rollback: see manual ROLLBACK block at the foot of this file.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- (1) Enum widening
-- ══════════════════════════════════════════════════════════════════════════

-- nav_group: add 'membership' + 'coaching'
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_nav_group_check;
ALTER TABLE programs ADD CONSTRAINT programs_nav_group_check
  CHECK (nav_group IN
    ('certifications','courses','retreats','micro-courses',
     'family','corporate','free','community',
     'membership','coaching'));

-- type: add 'membership_gated' + 'coaching-1on1'
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_type_check;
ALTER TABLE programs ADD CONSTRAINT programs_type_check
  CHECK (type IN
    ('certification','diploma','recorded-course','live-course',
     'retreat','micro-course','workshop','free-resource','service',
     'membership_gated','coaching-1on1'));

-- cross_list_nav_groups must permit the two new nav_groups as well.
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_cross_list_nav_groups_check;
ALTER TABLE programs ADD CONSTRAINT programs_cross_list_nav_groups_check
  CHECK (
    cross_list_nav_groups <@ ARRAY[
      'certifications','courses','retreats','micro-courses',
      'family','corporate','free','community',
      'membership','coaching'
    ]::text[]
  );

-- ══════════════════════════════════════════════════════════════════════════
-- (2) New columns (all nullable / default-safe)
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS member_discount_eligible    boolean,
  ADD COLUMN IF NOT EXISTS scholarship_eligible        boolean,
  ADD COLUMN IF NOT EXISTS membership_tier_required    text,
  ADD COLUMN IF NOT EXISTS coach_tier                  text,
  ADD COLUMN IF NOT EXISTS booking_mode                text,
  ADD COLUMN IF NOT EXISTS available_packages          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_content_hours         integer,
  ADD COLUMN IF NOT EXISTS typical_completion_weeks    text,
  ADD COLUMN IF NOT EXISTS lifetime_access_while_member boolean,
  ADD COLUMN IF NOT EXISTS includes_coach_checkin      boolean,
  ADD COLUMN IF NOT EXISTS application_only            boolean;

-- CHECK constraints for the new enum-shaped columns (nullable = OK when NULL)

ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_membership_tier_required_check;
ALTER TABLE programs ADD CONSTRAINT programs_membership_tier_required_check
  CHECK (membership_tier_required IS NULL OR membership_tier_required IN
    ('free','paid_1'));

ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_coach_tier_check;
ALTER TABLE programs ADD CONSTRAINT programs_coach_tier_check
  CHECK (coach_tier IS NULL OR coach_tier IN
    ('associate','professional','master','expert','samer'));

ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_booking_mode_check;
ALTER TABLE programs ADD CONSTRAINT programs_booking_mode_check
  CHECK (booking_mode IS NULL OR booking_mode IN
    ('open','discovery-first','invitation-after-conversation','application-only'));

-- ══════════════════════════════════════════════════════════════════════════
-- (3) UPDATE existing `somatic-thinking-intro` in place (row §16)
--     Transforms the legacy `recorded-course / certifications` row into the
--     canon `membership_gated / membership / free-tier` shape. Preserves the
--     row id and any inbound FKs.
-- ══════════════════════════════════════════════════════════════════════════

UPDATE programs SET
  title_ar                     = 'مدخل إلى التفكير الحسّي',
  title_en                     = 'An Introduction to Somatic Thinking',
  subtitle_ar                  = 'أن تبدأ من حيث أنت — بصوتك، وجسدك، وحضورك',
  subtitle_en                  = 'Begin where you are — with your voice, your body, your attention',
  description_ar               = 'لقاءٌ أوّل صادق مع طريقةٍ أخرى للتفكير — تبدأ ممّا يعرفه الجسد، وتصل إلى ما يتعلّم العقل قوله. ليس كورساً عن الحضور؛ بل تمريناً صغيراً موجَّهاً له. متاح مجّاناً لكل عضو في مجتمع كُنْ.',
  description_en               = 'A first, honest encounter with a different way of thinking — one that begins with what the body already knows and moves toward what the mind then learns to say. Not a course about presence; a small, guided practice of it. Free with Kun membership.',
  nav_group                    = 'membership',
  type                         = 'membership_gated',
  format                       = 'online',
  status                       = 'active',
  cta_type                     = 'enroll',
  track_color                  = '#7A9B89',
  membership_tier_required     = 'free',
  member_discount_eligible     = NULL,
  scholarship_eligible         = NULL,
  total_content_hours          = 6,
  typical_completion_weeks     = '2–4',
  lifetime_access_while_member = TRUE,
  includes_coach_checkin       = FALSE,
  application_only             = FALSE,
  is_free                      = TRUE,
  published                    = TRUE,
  updated_at                   = NOW()
WHERE slug = 'somatic-thinking-intro';

-- ══════════════════════════════════════════════════════════════════════════
-- (4) INSERT 7 new canonical programs
--     Idempotent via ON CONFLICT (slug) DO UPDATE so re-runs re-assert canon.
-- ══════════════════════════════════════════════════════════════════════════

-- §17 — self-paced-body-foundations (Paid-1 membership product)
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en,
  nav_group, type, format, status, cta_type, track_color,
  membership_tier_required, total_content_hours, typical_completion_weeks,
  lifetime_access_while_member, includes_coach_checkin, application_only,
  is_free, published
) VALUES (
  'self-paced-body-foundations',
  'أساسيات الإصغاء إلى الجسد',
  'Body Foundations — a self-paced practice',
  'مدرسة صغيرة لمن يريد أن يسمع جسده قبل أن يصرخ',
  'A small school for the one who wants to hear the body before it has to shout',
  'ممارسة ذاتيّة مركَّزة على الإصغاء إلى الجسد — إلى تعبه، وإشاراته، وهدايته الهادئة. ليست كورساً للياقة؛ كورسٌ للإصغاء. لمن يتكلّم جسده بالأعراض منذ زمن، ويريد أن يبدأ الإجابة. متاحة لأعضاء Paid-1.',
  'A focused self-paced practice on hearing the body — its tiredness, its signals, its quiet guidance. Not a fitness course; a listening course. For the person whose body has been speaking in symptoms and who wants to begin answering. Paid-1 member access.',
  'membership', 'membership_gated', 'online', 'active', 'enroll', '#7A9B89',
  'paid_1', 9, '6',
  TRUE, FALSE, FALSE,
  FALSE, TRUE
) ON CONFLICT (slug) DO UPDATE SET
  title_ar                     = EXCLUDED.title_ar,
  title_en                     = EXCLUDED.title_en,
  subtitle_ar                  = EXCLUDED.subtitle_ar,
  subtitle_en                  = EXCLUDED.subtitle_en,
  description_ar               = EXCLUDED.description_ar,
  description_en               = EXCLUDED.description_en,
  nav_group                    = EXCLUDED.nav_group,
  type                         = EXCLUDED.type,
  cta_type                     = EXCLUDED.cta_type,
  track_color                  = EXCLUDED.track_color,
  membership_tier_required     = EXCLUDED.membership_tier_required,
  total_content_hours          = EXCLUDED.total_content_hours,
  typical_completion_weeks     = EXCLUDED.typical_completion_weeks,
  lifetime_access_while_member = EXCLUDED.lifetime_access_while_member,
  includes_coach_checkin       = EXCLUDED.includes_coach_checkin,
  published                    = EXCLUDED.published,
  updated_at                   = NOW();

-- §18 — self-paced-compass-work (Paid-1 with coach check-in)
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en,
  nav_group, type, format, status, cta_type, track_color,
  membership_tier_required, total_content_hours, typical_completion_weeks,
  lifetime_access_while_member, includes_coach_checkin, application_only,
  is_free, published
) VALUES (
  'self-paced-compass-work',
  'بوصلة الاختيار — عمل ذاتيّ موجَّه',
  'The Compass of Choice — a guided self-practice',
  'لمن يقف أمام قرار — ويريد أن يعرف من الذي يقرّر قبل أن يقرّر',
  'For the one standing before a decision — who wants to meet the decider before deciding',
  'ممارسة ذاتيّة موجَّهة لمن يقف أمام مفترق — تحوُّل مهنيّ، "نعم" أو "لا" في علاقة، سؤال مرحلة قادمة. ليست إطاراً لاتّخاذ القرار؛ بل ممارسة إصغاء تُنظّف الضوضاء لتطفو إجابتك أنت. تتضمّن مراجعة واحدة مع كوتش كُنْ المعتمد في منتصف الرحلة. لأعضاء Paid-1.',
  'A structured self-paced practice for the person facing a fork — a career shift, a relational yes or no, a next-chapter question. Not a decision-making framework; a listening practice that clears the noise so your own answer can surface. Includes one asynchronous check-in with a certified Kun coach at the mid-point. Paid-1 member access.',
  'membership', 'membership_gated', 'online', 'active', 'enroll', '#1A2340',
  'paid_1', 12, '4–6',
  TRUE, TRUE, FALSE,
  FALSE, TRUE
) ON CONFLICT (slug) DO UPDATE SET
  title_ar                     = EXCLUDED.title_ar,
  title_en                     = EXCLUDED.title_en,
  subtitle_ar                  = EXCLUDED.subtitle_ar,
  subtitle_en                  = EXCLUDED.subtitle_en,
  description_ar               = EXCLUDED.description_ar,
  description_en               = EXCLUDED.description_en,
  nav_group                    = EXCLUDED.nav_group,
  type                         = EXCLUDED.type,
  cta_type                     = EXCLUDED.cta_type,
  track_color                  = EXCLUDED.track_color,
  membership_tier_required     = EXCLUDED.membership_tier_required,
  total_content_hours          = EXCLUDED.total_content_hours,
  typical_completion_weeks     = EXCLUDED.typical_completion_weeks,
  lifetime_access_while_member = EXCLUDED.lifetime_access_while_member,
  includes_coach_checkin       = EXCLUDED.includes_coach_checkin,
  published                    = EXCLUDED.published,
  updated_at                   = NOW();

-- §19 — coaching-1on1-associate (Tier 1, AR label: كوتش per F.2)
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en,
  nav_group, type, format, status, cta_type, track_color,
  coach_tier, booking_mode, available_packages,
  member_discount_eligible, scholarship_eligible, application_only,
  is_free, published
) VALUES (
  'coaching-1on1-associate',
  'كوتشينج فرديّ — كوتش',
  'One-to-one coaching — Associate',
  'أوّل لقاء مع كوتش مُعتمد — رفقة على خطوتك التالية',
  'Your first work with a certified coach — companionship for your next step',
  'كوتشينج فرديّ مع كوتش كُنْ المعتمد. لقراراتك اليوميّة، ولكسر نمط تكرّر، ولدمج ما عشته في ورشة في حياتك. ابدأ بجلسة تعارف مجّانيّة ٢٠ دقيقة، ثم حزمة من ٣ أو ٨ جلسات.',
  'One-to-one work with a certified Kun coach. For your day-to-day decisions, for breaking a repeating pattern, for integrating workshop learning into daily life. Start with a free 20-minute Discovery, then a package of 3 or 8 sessions.',
  'coaching', 'coaching-1on1', 'online', 'active', 'enroll', '#4A6FA5',
  'associate', 'discovery-first',
  ARRAY['discovery-20min','single-session','package-of-3','package-of-8']::text[],
  TRUE, TRUE, FALSE,
  FALSE, TRUE
) ON CONFLICT (slug) DO UPDATE SET
  title_ar                 = EXCLUDED.title_ar,
  title_en                 = EXCLUDED.title_en,
  subtitle_ar              = EXCLUDED.subtitle_ar,
  subtitle_en              = EXCLUDED.subtitle_en,
  description_ar           = EXCLUDED.description_ar,
  description_en           = EXCLUDED.description_en,
  nav_group                = EXCLUDED.nav_group,
  type                     = EXCLUDED.type,
  cta_type                 = EXCLUDED.cta_type,
  track_color              = EXCLUDED.track_color,
  coach_tier               = EXCLUDED.coach_tier,
  booking_mode             = EXCLUDED.booking_mode,
  available_packages       = EXCLUDED.available_packages,
  member_discount_eligible = EXCLUDED.member_discount_eligible,
  scholarship_eligible     = EXCLUDED.scholarship_eligible,
  published                = EXCLUDED.published,
  updated_at               = NOW();

-- §20 — coaching-1on1-professional (Tier 2)
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en,
  nav_group, type, format, status, cta_type, track_color,
  coach_tier, booking_mode, available_packages,
  member_discount_eligible, scholarship_eligible, application_only,
  is_free, published
) VALUES (
  'coaching-1on1-professional',
  'كوتشينج فرديّ — محترف',
  'One-to-one coaching — Professional',
  'رفقة أعمق مع كوتش متقدّم — لِما لم يعد يُحلّ بالخطوات',
  'Deeper work with an advanced coach — for what can no longer be solved in steps',
  'كوتشينج فرديّ مع كوتش متقدّم معتمد. للعمل على أنماط متكرّرة، لإشارات جسديّة اعتدتَ تجاوزها، لسؤال هويّة لا يُحلّ بخطوات.',
  'One-to-one work with an advanced certified coach. For working on recurring patterns, on bodily signals you have been managing rather than listening to, on identity-level questions that will not be solved in steps.',
  'coaching', 'coaching-1on1', 'online', 'active', 'enroll', '#4A6FA5',
  'professional', 'discovery-first',
  ARRAY['discovery-20min','single-session','package-of-3','package-of-8']::text[],
  FALSE, TRUE, FALSE,
  FALSE, TRUE
) ON CONFLICT (slug) DO UPDATE SET
  title_ar                 = EXCLUDED.title_ar,
  title_en                 = EXCLUDED.title_en,
  subtitle_ar              = EXCLUDED.subtitle_ar,
  subtitle_en              = EXCLUDED.subtitle_en,
  description_ar           = EXCLUDED.description_ar,
  description_en           = EXCLUDED.description_en,
  nav_group                = EXCLUDED.nav_group,
  type                     = EXCLUDED.type,
  cta_type                 = EXCLUDED.cta_type,
  track_color              = EXCLUDED.track_color,
  coach_tier               = EXCLUDED.coach_tier,
  booking_mode             = EXCLUDED.booking_mode,
  available_packages       = EXCLUDED.available_packages,
  member_discount_eligible = EXCLUDED.member_discount_eligible,
  scholarship_eligible     = EXCLUDED.scholarship_eligible,
  published                = EXCLUDED.published,
  updated_at               = NOW();

-- §21 — coaching-1on1-master (Tier 3, canon: experienced PCC, 6–10y)
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en,
  nav_group, type, format, status, cta_type, track_color,
  coach_tier, booking_mode, available_packages,
  member_discount_eligible, scholarship_eligible, application_only,
  is_free, published
) VALUES (
  'coaching-1on1-master',
  'كوتشينج فرديّ — ماستر',
  'One-to-one coaching — Master',
  'عمل متقدّم مع كوتش ذو خبرة — لِما يحتاج حضوراً ناضجاً',
  'Advanced work with an experienced coach — for what needs a mature presence',
  'كوتشينج فرديّ مع كوتش ذو خبرة ممتدّة. للقاء الخوف برعاية ناضجة، للحزن ولانتقالات الفصل الحياتيّ، لعمل هويّة متقدّم.',
  'One-to-one work with an experienced coach. For meeting fear with mature holding, for grief and life-chapter transitions, for advanced identity-level work.',
  'coaching', 'coaching-1on1', 'online', 'active', 'enroll', '#4A6FA5',
  'master', 'discovery-first',
  ARRAY['discovery-20min','single-session','package-of-3','package-of-8']::text[],
  FALSE, FALSE, FALSE,
  FALSE, TRUE
) ON CONFLICT (slug) DO UPDATE SET
  title_ar                 = EXCLUDED.title_ar,
  title_en                 = EXCLUDED.title_en,
  subtitle_ar              = EXCLUDED.subtitle_ar,
  subtitle_en              = EXCLUDED.subtitle_en,
  description_ar           = EXCLUDED.description_ar,
  description_en           = EXCLUDED.description_en,
  nav_group                = EXCLUDED.nav_group,
  type                     = EXCLUDED.type,
  cta_type                 = EXCLUDED.cta_type,
  track_color              = EXCLUDED.track_color,
  coach_tier               = EXCLUDED.coach_tier,
  booking_mode             = EXCLUDED.booking_mode,
  available_packages       = EXCLUDED.available_packages,
  member_discount_eligible = EXCLUDED.member_discount_eligible,
  scholarship_eligible     = EXCLUDED.scholarship_eligible,
  published                = EXCLUDED.published,
  updated_at               = NOW();

-- §22 — coaching-1on1-expert (Tier 4, canon: MCC, 10+y, Kun-selected)
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en,
  nav_group, type, format, status, cta_type, track_color,
  coach_tier, booking_mode, available_packages,
  member_discount_eligible, scholarship_eligible, application_only,
  is_free, published
) VALUES (
  'coaching-1on1-expert',
  'كوتشينج فرديّ — خبير',
  'One-to-one coaching — Expert',
  'عمل مع كوتش خبير لمن بنى شيئاً عظيماً ويبحث عن نفسه داخله',
  'Expert-level work for the one who built something great and is looking for themselves inside it',
  'كوتشينج فرديّ مع كوتش خبير باختيار كُنْ. لعمل المؤسّسين والقادة على مستوى الهويّة، ولأسئلة الإرث. بدعوة بعد محادثة قصيرة.',
  'One-to-one work with a Kun-selected Expert-tier coach. Founder and senior-leader identity work, legacy and impact reconfiguration questions. By invitation after a short conversation.',
  'coaching', 'coaching-1on1', 'online', 'active', 'enroll', '#4A6FA5',
  'expert', 'invitation-after-conversation',
  ARRAY['discovery-conversation','single-session','package-of-3','package-of-8']::text[],
  FALSE, FALSE, FALSE,
  FALSE, TRUE
) ON CONFLICT (slug) DO UPDATE SET
  title_ar                 = EXCLUDED.title_ar,
  title_en                 = EXCLUDED.title_en,
  subtitle_ar              = EXCLUDED.subtitle_ar,
  subtitle_en              = EXCLUDED.subtitle_en,
  description_ar           = EXCLUDED.description_ar,
  description_en           = EXCLUDED.description_en,
  nav_group                = EXCLUDED.nav_group,
  type                     = EXCLUDED.type,
  cta_type                 = EXCLUDED.cta_type,
  track_color              = EXCLUDED.track_color,
  coach_tier               = EXCLUDED.coach_tier,
  booking_mode             = EXCLUDED.booking_mode,
  available_packages       = EXCLUDED.available_packages,
  member_discount_eligible = EXCLUDED.member_discount_eligible,
  scholarship_eligible     = EXCLUDED.scholarship_eligible,
  published                = EXCLUDED.published,
  updated_at               = NOW();

-- §23 — coaching-1on1-samer (founder-tier application-only, E2=b)
-- Pricing posture opaque-until-public per F.3 Hakima recommendation.
-- Revenue 100% to Samer personally (distinct treasury posture).
INSERT INTO programs (
  slug, title_ar, title_en, subtitle_ar, subtitle_en,
  description_ar, description_en,
  nav_group, type, format, status, cta_type, track_color,
  coach_tier, booking_mode, available_packages,
  member_discount_eligible, scholarship_eligible, application_only,
  is_free, published
) VALUES (
  'coaching-1on1-samer',
  'كوتشينج فرديّ مع سامر حسن',
  'One-to-one coaching with Samer Hassan',
  'عمل مباشر مع مؤسّس المنهجية — بالدعوة فقط',
  'Direct work with the methodology''s founder — by invitation only',
  'عمل مباشر مع سامر حسن في كوتشينج المؤسّسين والقادة على مستوى المصدر. بدعوة فقط بعد مراجعة طلب. تسعير تأسيسيّ متميّز — تفاصيله عند قبول الطلب.',
  'Direct work with Samer Hassan in founder and senior-leader coaching at the methodology''s source. Application-only. Founder premium pricing — shared upon application acceptance.',
  'coaching', 'coaching-1on1', 'online', 'active', 'contact', '#1A2340',
  'samer', 'application-only',
  ARRAY['application-only']::text[],
  FALSE, FALSE, TRUE,
  FALSE, TRUE
) ON CONFLICT (slug) DO UPDATE SET
  title_ar                 = EXCLUDED.title_ar,
  title_en                 = EXCLUDED.title_en,
  subtitle_ar              = EXCLUDED.subtitle_ar,
  subtitle_en              = EXCLUDED.subtitle_en,
  description_ar           = EXCLUDED.description_ar,
  description_en           = EXCLUDED.description_en,
  nav_group                = EXCLUDED.nav_group,
  type                     = EXCLUDED.type,
  cta_type                 = EXCLUDED.cta_type,
  track_color              = EXCLUDED.track_color,
  coach_tier               = EXCLUDED.coach_tier,
  booking_mode             = EXCLUDED.booking_mode,
  available_packages       = EXCLUDED.available_packages,
  member_discount_eligible = EXCLUDED.member_discount_eligible,
  scholarship_eligible     = EXCLUDED.scholarship_eligible,
  application_only         = EXCLUDED.application_only,
  published                = EXCLUDED.published,
  updated_at               = NOW();

-- ══════════════════════════════════════════════════════════════════════════
-- (5) Flag UPDATEs on existing canonical programs per §D.4
--     GPS + Wisal + Seeds-Parents + Ihya family = eligible on both flags.
--     STFC + Seeds-Caregivers + Seeds-Youth (school-contracted) = neither.
--     Other programs (micro-courses, diplomas, legacy) keep NULL (not in canon
--     scope for membership/scholarship).
-- ══════════════════════════════════════════════════════════════════════════

-- GPS family (4 programs)
UPDATE programs SET
  member_discount_eligible = TRUE,
  scholarship_eligible     = TRUE,
  updated_at               = NOW()
WHERE slug IN (
  'gps-of-life',
  'gps-accelerator',
  'gps-couples',
  'gps-entrepreneurs'
);

-- Wisal (proposal-based but discount applies to base rate per §M.4)
UPDATE programs SET
  member_discount_eligible = TRUE,
  scholarship_eligible     = TRUE,
  updated_at               = NOW()
WHERE slug = 'wisal';

-- Seeds Parents (individually-bookable — both flags TRUE)
UPDATE programs SET
  member_discount_eligible = TRUE,
  scholarship_eligible     = TRUE,
  updated_at               = NOW()
WHERE slug = 'seeds-parents';

-- Seeds Youth + Seeds Caregivers (school-contracted / license-delivery —
-- separate partnership pricing; neither flag applies per §D.4 note).
UPDATE programs SET
  member_discount_eligible = FALSE,
  scholarship_eligible     = FALSE,
  updated_at               = NOW()
WHERE slug IN ('seeds-youth','seeds-caregivers');

-- Ihya family (6 programs)
UPDATE programs SET
  member_discount_eligible = TRUE,
  scholarship_eligible     = TRUE,
  updated_at               = NOW()
WHERE slug IN (
  'ihya-reviving-the-self',
  'ihya-body',
  'ihya-impact',
  'ihya-innovation',
  'ihya-connection',
  'ihya-grand-journey'
);

-- STFC (paid certification — neither flag per §D.4 footer)
UPDATE programs SET
  member_discount_eligible = FALSE,
  scholarship_eligible     = FALSE,
  updated_at               = NOW()
WHERE slug = 'stce-level-5-stfc';

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, not auto-executed)
-- ══════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   -- (a) remove 7 new canonical rows (somatic-thinking-intro is transformed
--   --     in place, not inserted — rollback restores the legacy shape below).
--   DELETE FROM programs WHERE slug IN (
--     'self-paced-body-foundations',
--     'self-paced-compass-work',
--     'coaching-1on1-associate',
--     'coaching-1on1-professional',
--     'coaching-1on1-master',
--     'coaching-1on1-expert',
--     'coaching-1on1-samer'
--   );
--
--   -- (b) restore somatic-thinking-intro to pre-0053 legacy shape
--   UPDATE programs SET
--     nav_group                    = 'certifications',
--     type                         = 'recorded-course',
--     membership_tier_required     = NULL,
--     total_content_hours          = NULL,
--     typical_completion_weeks     = NULL,
--     lifetime_access_while_member = NULL,
--     includes_coach_checkin       = NULL,
--     application_only             = NULL,
--     is_free                      = FALSE,
--     updated_at                   = NOW()
--   WHERE slug = 'somatic-thinking-intro';
--
--   -- (c) null-out flags on existing programs
--   UPDATE programs SET
--     member_discount_eligible = NULL,
--     scholarship_eligible     = NULL,
--     updated_at               = NOW()
--   WHERE slug IN (
--     'gps-of-life','gps-accelerator','gps-couples','gps-entrepreneurs',
--     'wisal','seeds-parents','seeds-youth','seeds-caregivers',
--     'ihya-reviving-the-self','ihya-body','ihya-impact',
--     'ihya-innovation','ihya-connection','ihya-grand-journey',
--     'stce-level-5-stfc'
--   );
--
--   -- (d) drop new CHECK constraints
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_booking_mode_check;
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_coach_tier_check;
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_membership_tier_required_check;
--
--   -- (e) drop new columns
--   ALTER TABLE programs
--     DROP COLUMN IF EXISTS application_only,
--     DROP COLUMN IF EXISTS includes_coach_checkin,
--     DROP COLUMN IF EXISTS lifetime_access_while_member,
--     DROP COLUMN IF EXISTS typical_completion_weeks,
--     DROP COLUMN IF EXISTS total_content_hours,
--     DROP COLUMN IF EXISTS available_packages,
--     DROP COLUMN IF EXISTS booking_mode,
--     DROP COLUMN IF EXISTS coach_tier,
--     DROP COLUMN IF EXISTS membership_tier_required,
--     DROP COLUMN IF EXISTS scholarship_eligible,
--     DROP COLUMN IF EXISTS member_discount_eligible;
--
--   -- (f) restore enum CHECKs to pre-0053 shape (0039/0040 state)
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_cross_list_nav_groups_check;
--   ALTER TABLE programs ADD CONSTRAINT programs_cross_list_nav_groups_check
--     CHECK (cross_list_nav_groups <@ ARRAY[
--       'certifications','courses','retreats','micro-courses',
--       'family','corporate','free','community'
--     ]::text[]);
--
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_type_check;
--   ALTER TABLE programs ADD CONSTRAINT programs_type_check
--     CHECK (type IN
--       ('certification','diploma','recorded-course','live-course',
--        'retreat','micro-course','workshop','free-resource','service'));
--
--   ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_nav_group_check;
--   ALTER TABLE programs ADD CONSTRAINT programs_nav_group_check
--     CHECK (nav_group IN
--       ('certifications','courses','retreats','micro-courses',
--        'family','corporate','free','community'));
-- COMMIT;
