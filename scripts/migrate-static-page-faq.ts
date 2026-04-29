#!/usr/bin/env npx tsx
/**
 * Wave 15 Wave 4 Route 1 (2026-04-29) — Migrate hand-written /faq → static_pages row.
 *
 * Source: the 8 used FAQ collections in apps/web/src/data/faqs.ts that the
 * pre-Wave-4 /faq route concatenated and rendered through @kunacademy/ui's
 * FAQSection accordion. Spec §7.1 + Wave 4 PRECURSOR commit `2380f81` shipped
 * the `faq_accordion` static-specific section type which this script targets.
 *
 * Output: ONE row in static_pages:
 *   slug='faq', kind='static', status='published', published=true.
 *   composition_json.sections = [{ type: 'faq_accordion', items: [...32 items] }]
 *   hero_json carries the PageHero copy (title/subtitle/eyebrow + pattern)
 *   seo_meta_json carries the prior generateMetadata() title/description bilingually.
 *
 * Idempotent: ON CONFLICT (slug) DO UPDATE — re-runs replace content in place.
 * Re-running is the intended way to re-pull edits from THIS file back into the DB
 * (during the migration window only — once the row is editable in the admin UI,
 * the DB is source of truth and this script becomes a one-shot historic seed).
 *
 * Author surface: this is a one-shot seeder. Per CLAUDE.md "no service-role
 * bypass" rule we use the kunacademy_admin DB role (not BYPASSRLS) — RLS
 * policies on static_pages explicitly grant kunacademy_admin INSERT/UPDATE
 * (migration 0065 §RLS).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-static-page-faq.ts
 *   DRY_RUN=1                  npx tsx scripts/migrate-static-page-faq.ts
 *   EMIT_SQL=/tmp/seed.sql     npx tsx scripts/migrate-static-page-faq.ts
 *     — no DB write; emits an idempotent .sql seed safe for non-BYPASSRLS roles.
 *     Apply with: sudo -u postgres psql kunacademy -f <file>
 */

import { writeFileSync } from 'fs';
import { Client } from 'pg';

// ── FAQ source (copied verbatim from apps/web/src/data/faqs.ts) ─────────────
//
// We inline the data instead of importing the TS module so the script runs
// without webpack/Next path aliases. The 8 collections below are the EXACT
// 32 items the pre-Wave-4 /faq route rendered (in the EXACT concatenation
// order: about → methodology → programs → stce → coaching → corporate →
// family → booking). Item order is preserved end-to-end so the
// rendered output is byte-equivalent to the prior hand-written page.
//
// IMPORTANT: when data/faqs.ts changes (8 collections still consumed by 8
// other routes — about, methodology, etc.), this script does NOT auto-pull
// updates. Edits made in admin UI win. Re-run the script ONLY to re-seed
// after a wipe.

interface SourceFaqItem {
  ar: { q: string; a: string };
  en: { q: string; a: string };
}

const aboutFaqs: SourceFaqItem[] = [
  {
    ar: { q: 'من هو سامر حسن؟', a: 'سامر حسن هو أول عربي يحمل شهادة MCC من الاتحاد الدولي للكوتشنغ (ICF)، مؤسس منهجية التفكير الحسّي®، ومدرّب أكثر من 500 كوتش في 4 قارات.' },
    en: { q: 'Who is Samer Hassan?', a: 'Samer Hassan is an ICF Master Certified Coach (MCC), ICF Young Leader Award recipient (2019), founder of Somatic Thinking®, and has trained 500+ coaches across 4 continents.' },
  },
  {
    ar: { q: 'أين يقع مقر أكاديمية كُن؟', a: 'المقر الرئيسي في منطقة ميدان الحرة، دبي، الإمارات العربية المتحدة. نقدّم برامجنا في الخليج العربي وعبر الإنترنت عالميًا.' },
    en: { q: 'Where is Kun Academy based?', a: 'Our headquarters are in Meydan Free Zone, Dubai, UAE. We deliver programs across the GCC and globally online.' },
  },
  {
    ar: { q: 'ما معنى "كُن"؟', a: '"كُن" كلمة قرآنية تعني "كُن فيكون" — أمر الله بالتكوين. اسم الأكاديمية يعكس الإيمان بقدرة الإنسان على التحوّل الحقيقي عندما يبدأ من النَّفْس.' },
    en: { q: 'What does "Kun" mean?', a: '"Kun" is a Quranic word meaning "Be" — the divine command of creation. The academy\'s name reflects the belief in human capacity for genuine transformation when it starts from the self.' },
  },
];

const methodologyFaqs: SourceFaqItem[] = [
  {
    ar: { q: 'ما الفرق بين التفكير الحسّي والكوتشينج الجسدي (Somatic Coaching)؟', a: 'التفكير الحسّي® منهجية مستقلة طوّرها سامر حسن تدمج الإشارات الحسّية الجسدية مع إطار توحيدي لفهم النَّفْس. وهي ليست ترجمة أو فرعًا من Somatic Coaching الغربي.' },
    en: { q: 'How is Somatic Thinking different from Somatic Coaching?', a: 'Somatic Thinking® is an independent methodology developed by Samer Hassan that integrates somatic body signals with a Tawhidi framework for understanding the self (النَّفْس). It is not a translation or branch of Western Somatic Coaching.' },
  },
  {
    ar: { q: 'هل المنهجية مبنية على أدلة علمية؟', a: 'نعم. التفكير الحسّي يستند إلى أبحاث علم الأعصاب حول الإدراك الجسدي (Interoception) والإدراك المتجسّد (Embodied Cognition)، مع إطار فلسفي مستمد من التراث الإسلامي.' },
    en: { q: 'Is the methodology evidence-based?', a: 'Yes. Somatic Thinking draws on neuroscience research in interoception and embodied cognition, combined with a philosophical framework rooted in Islamic intellectual heritage.' },
  },
  {
    ar: { q: 'هل أحتاج خلفية في علم النفس لدراسة التفكير الحسّي؟', a: 'لا. المنهجية مصمّمة لتكون تجريبية — تبدأ من خبرة الجسد لا من النظرية. نرحّب بالمهنيين من جميع الخلفيات.' },
    en: { q: 'Do I need a psychology background to study Somatic Thinking?', a: 'No. The methodology is designed to be experiential — it starts from bodily experience, not theory. We welcome professionals from all backgrounds.' },
  },
  {
    ar: { q: 'هل التفكير الحسّي نوع من العلاج النفسي؟', a: 'لا. التفكير الحسّي® منهجية كوتشينج معتمدة من ICF — وليست علاجاً نفسياً. الفرق الجوهري: الكوتشينج يتعامل مع أشخاص أصحاء يريدون التطوّر، لا مع اضطرابات تحتاج تدخّلاً علاجياً.' },
    en: { q: 'Is Somatic Thinking a form of therapy?', a: 'No. Somatic Thinking® is an ICF-accredited coaching methodology — not therapy. The key distinction: coaching works with healthy individuals who want to grow, not with disorders that require clinical intervention.' },
  },
  {
    ar: { q: 'هل أحتاج أن أكون كوتشاً لأستفيد من التفكير الحسّي؟', a: 'لا. المنهجية تُفيد القادة والمدراء والأفراد الذين يريدون فهم أنفسهم بعمق. لكن إذا كنت كوتشاً، فستُضيف طبقة حسّية كاملة لأدواتك.' },
    en: { q: 'Do I need to be a coach to benefit from Somatic Thinking?', a: 'No. The methodology benefits leaders, managers, and individuals who want to understand themselves more deeply. But if you\'re a coach, it will add a complete somatic layer to your toolkit.' },
  },
  {
    ar: { q: 'ما معنى الاعتماد من ICF وكيف يتعلق بالتفكير الحسّي؟', a: 'ICF (الاتحاد الدولي للكوتشينج) هو أعلى جهة اعتماد لمنهجيات الكوتشينج في العالم. برنامج STCE المبني على التفكير الحسّي® معتمد منه — يعني أن ساعاتك التدريبية تُحتسب رسمياً نحو شهادتي ACC وPCC.' },
    en: { q: 'What is ICF accreditation and how does it relate to Somatic Thinking?', a: 'ICF (International Coaching Federation) is the world\'s highest coaching accreditation body. The STCE program built on Somatic Thinking® is ICF-accredited — meaning your training hours officially count toward ACC and PCC credentials.' },
  },
  {
    ar: { q: 'من طوّر التفكير الحسّي؟', a: 'سامر حسن، MCC — أول متحدث عربي أصلي يحصل على شهادة ماستر كوتش معتمد من ICF. طوّر التفكير الحسّي على مدى أكثر من ١٥ عامًا من ممارسة الكوتشينج المهني، مستندًا إلى أكثر من ٣٠ عامًا من الفنون القتالية والعلاجية عبر أربع قارات.' },
    en: { q: 'Who developed Somatic Thinking?', a: 'Samer Hassan, MCC — the first native Arabic speaker to earn the ICF Master Certified Coach credential. He developed Somatic Thinking over 15+ years of professional coaching practice, informed by 30+ years of martial and healing arts across four continents.' },
  },
  {
    ar: { q: 'هل التفكير الحسّي منهجية دينية؟', a: 'لا. رغم أن أساسه الفلسفي يستلهم من التراث الفكري الإسلامي (مفهوم النَّفْس والوحدة التوحيدية)، إلا أن المنهجية مصمّمة لتكون عالمية ثقافيًا. مارسها أشخاص من جميع الأديان ومن بلا أديان في ١٣ دولة.' },
    en: { q: 'Is Somatic Thinking a religious methodology?', a: 'No. While its philosophical foundation draws from Islamic intellectual heritage (the concept of النَّفْس and Tawhidi unity), the methodology is designed to be culturally universal. It has been practiced by people of all faiths and no faith across 13 countries.' },
  },
  {
    ar: { q: 'كيف يُعتمد التفكير الحسّي؟', a: 'برنامج تعليم كوتش التفكير الحسّي (STCE) معتمد من الاتحاد الدولي للكوتشينج (ICF) في المستوى الأول (مسار ACC، ٦٩ ساعة) والمستوى الثاني (مسار PCC، ٧٥ ساعة). برنامج STAIC المتقدّم يوفّر مسار MCC.' },
    en: { q: 'How is Somatic Thinking accredited?', a: 'The Somatic Thinking Coach Education (STCE) program is accredited by the International Coaching Federation (ICF) at Level 1 (ACC pathway, 69 hours) and Level 2 (PCC pathway, 75 hours). The STAIC advanced program offers an MCC pathway.' },
  },
];

const programsFaqs: SourceFaqItem[] = [
  {
    ar: { q: 'كيف أختار البرنامج المناسب لي؟', a: 'ابدأ باختبار تحديد المسار على موقعنا — يساعدك في تحديد البرنامج الأنسب لأهدافك وخبرتك الحالية. أو تواصل معنا مباشرة للاستشارة المجانية.' },
    en: { q: 'How do I choose the right program?', a: 'Start with our Program Finder Quiz — it helps match you to the best program based on your goals and current experience. Or contact us directly for a free consultation.' },
  },
  {
    ar: { q: 'هل يمكنني الانتقال بين المستويات؟', a: 'نعم، المسار التعليمي مصمّم بشكل تصاعدي. بعد إتمام أي مستوى يمكنك الانتقال للمستوى التالي مباشرة.' },
    en: { q: 'Can I progress between levels?', a: 'Yes, the learning pathway is designed progressively. After completing any level, you can advance directly to the next one.' },
  },
  {
    ar: { q: 'هل البرامج متاحة أونلاين؟', a: 'معظم برامجنا تُقدّم عبر الإنترنت مباشرةً (Live Online). بعض البرامج المتقدّمة تتضمّن أيامًا حضورية في دبي.' },
    en: { q: 'Are programs available online?', a: 'Most of our programs are delivered live online. Some advanced programs include in-person days in Dubai.' },
  },
  {
    ar: { q: 'هل يوجد خصم للتسجيل المبكر؟', a: 'نعم، نوفّر خصم التسجيل المبكر وخطط تقسيط مرنة. تفاصيل الأسعار موجودة في صفحة كل برنامج.' },
    en: { q: 'Is there an early-bird discount?', a: 'Yes, we offer early-bird discounts and flexible payment plans. Pricing details are on each program page.' },
  },
];

const stceFaqs: SourceFaqItem[] = [
  {
    ar: { q: 'ما الفرق بين مستويات STCE الخمسة؟', a: 'المستوى ١: أساسيات الكوتشينج والتفكير الحسّي (٦٩ ساعة، مسار ACC). المستوى ٢: تعميق المهارات مع كوتشينج حقيقي للعملاء (٧٥ ساعة، مسار PCC). المستوى ٣: كوتشينج المجموعات (٤٠ ساعة). المستوى ٤: كوتشينج المؤسسات (٣٦ ساعة). المستوى ٥: كوتشينج العائلات والأزواج (٢٠ ساعة).' },
    en: { q: 'What is the difference between the five STCE levels?', a: 'Level 1: Coaching foundations through Somatic Thinking (69 hours, ACC pathway). Level 2: Advanced skills with real client coaching (75 hours, PCC pathway). Level 3: Group Coaching (40 hours). Level 4: Organizational Coaching (36 hours). Level 5: Family & Couples Coaching (20 hours).' },
  },
  {
    ar: { q: 'كم ساعة تدريب معتمدة أحصل عليها؟', a: 'المستوى ١ يمنحك ٦٩ ساعة تدريب معتمدة من ICF (مسار ACC). المستوى ٢ يضيف ٧٥ ساعة (مسار PCC). المستويات ٣-٥ تضيف ٩٦ ساعة إضافية. المجموع ٢٤٠ ساعة.' },
    en: { q: 'How many accredited training hours do I get?', a: 'Level 1 gives you 69 ICF-accredited hours (ACC pathway). Level 2 adds 75 hours (PCC pathway). Levels 3-5 add 96 more hours. Total: 240 hours across all five levels.' },
  },
  {
    ar: { q: 'هل يمكنني التسجيل مباشرة في المستوى 2؟', a: 'المستوى 2 يتطلب إتمام المستوى 1 أولاً. إذا كنت تحمل شهادة كوتشينج معتمدة من مؤسسة أخرى، تواصل معنا لتقييم إمكانية الانتقال المباشر.' },
    en: { q: 'Can I enroll directly in Level 2?', a: 'Level 2 requires completing Level 1 first. If you hold an accredited coaching certification from another institution, contact us to assess direct entry eligibility.' },
  },
  {
    ar: { q: 'ما المطلوب للحصول على شهادة STCE؟', a: 'حضور جميع الجلسات، إتمام التطبيقات العملية، اجتياز التقييم النهائي، وإكمال ساعات الكوتشينج المطلوبة تحت الإشراف.' },
    en: { q: 'What are the requirements to earn an STCE certificate?', a: 'Attend all sessions, complete practical assignments, pass the final assessment, and fulfill the required supervised coaching hours.' },
  },
];

const coachingFaqs: SourceFaqItem[] = [
  {
    ar: { q: 'كيف أحجز جلسة كوتشينج؟', a: 'اختر الكوتش المناسب من دليل الكوتشز، حدّد الموعد المتاح، وأكمل الدفع. ستصلك تفاصيل الجلسة عبر البريد الإلكتروني.' },
    en: { q: 'How do I book a coaching session?', a: 'Choose your preferred coach from the Coach Directory, select an available time slot, and complete payment. Session details will be sent to your email.' },
  },
  {
    ar: { q: 'ما هي مدة الجلسة الواحدة؟', a: 'الجلسة الفردية 60 دقيقة. تتوفّر أيضًا جلسات مكثّفة بمدة 90 دقيقة.' },
    en: { q: 'How long is each session?', a: 'Individual sessions are 60 minutes. Intensive 90-minute sessions are also available.' },
  },
  {
    ar: { q: 'هل يمكنني تغيير أو إلغاء الموعد؟', a: 'يمكنك إعادة جدولة أو إلغاء الجلسة قبل 24 ساعة على الأقل من الموعد المحدّد دون رسوم إضافية.' },
    en: { q: 'Can I reschedule or cancel?', a: 'You can reschedule or cancel at least 24 hours before your scheduled session at no extra charge.' },
  },
];

const corporateFaqs: SourceFaqItem[] = [
  {
    ar: { q: 'كيف يختلف الكوتشينج المؤسسي عن البرامج الفردية؟', a: 'البرامج المؤسسية مصمّمة خصيصًا لأهداف المؤسسة — تشمل تقييم الاحتياجات، تصميم مخصّص، وقياس الأثر على مستوى الفريق والقيادة.' },
    en: { q: 'How does corporate coaching differ from individual programs?', a: 'Corporate programs are tailored to organizational goals — including needs assessment, custom design, and impact measurement at team and leadership levels.' },
  },
  {
    ar: { q: 'ما هو الحد الأدنى لعدد المشاركين؟', a: 'البرامج المؤسسية تبدأ من 8 مشاركين. للجلسات الفردية التنفيذية لا يوجد حد أدنى.' },
    en: { q: 'What is the minimum number of participants?', a: 'Corporate programs start from 8 participants. For individual executive coaching sessions, there is no minimum.' },
  },
  {
    ar: { q: 'هل تقدّمون البرامج في مقر المؤسسة؟', a: 'نعم، نقدّم البرامج في مقر المؤسسة في دول الخليج، أو عبر الإنترنت، أو في مقرّنا بدبي.' },
    en: { q: 'Do you deliver programs on-site?', a: 'Yes, we deliver programs on-site across the GCC, online, or at our Dubai location.' },
  },
];

const familyFaqs: SourceFaqItem[] = [
  {
    ar: { q: 'ما هو العمر المناسب لبرامج الشباب؟', a: 'برامج الشباب مصمّمة للفئة العمرية 14-25 سنة. برامج الأسرة مفتوحة للوالدين بغض النظر عن أعمار أبنائهم.' },
    en: { q: 'What age group are youth programs designed for?', a: 'Youth programs are designed for ages 14-25. Family programs are open to parents regardless of their children\'s ages.' },
  },
  {
    ar: { q: 'هل يمكن للوالدين حضور البرنامج معًا؟', a: 'نشجّع ذلك بشدة. نوفّر خصمًا خاصًا عند تسجيل كلا الوالدين معًا.' },
    en: { q: 'Can both parents attend together?', a: 'We strongly encourage it. We offer a special discount when both parents enroll together.' },
  },
  {
    ar: { q: 'هل البرامج الأسرية تتضمّن جلسات فردية؟', a: 'نعم، بعض البرامج تجمع بين ورش العمل الجماعية وجلسات كوتشينج فردية للوالدين.' },
    en: { q: 'Do family programs include individual sessions?', a: 'Yes, some programs combine group workshops with individual coaching sessions for parents.' },
  },
];

const bookingFaqs: SourceFaqItem[] = [
  {
    ar: { q: 'ما هي طرق الدفع المتاحة؟', a: 'نقبل بطاقات الائتمان (Visa, Mastercard)، التحويل البنكي، والدفع بالتقسيط عبر Tabby.' },
    en: { q: 'What payment methods are accepted?', a: 'We accept credit cards (Visa, Mastercard), bank transfers, and installment payments via Tabby.' },
  },
  {
    ar: { q: 'هل يمكنني الدفع بالتقسيط؟', a: 'نعم، نوفّر خطط تقسيط مرنة عبر Tabby (3-4 أقساط بدون فوائد) ولمعظم البرامج.' },
    en: { q: 'Can I pay in installments?', a: 'Yes, we offer flexible installment plans via Tabby (3-4 interest-free payments) for most programs.' },
  },
  {
    ar: { q: 'ما هي سياسة الاسترداد؟', a: 'يمكنك طلب استرداد كامل خلال 14 يومًا من التسجيل إذا لم تبدأ البرنامج. التفاصيل في صفحة سياسة الاسترداد.' },
    en: { q: 'What is the refund policy?', a: 'You can request a full refund within 14 days of enrollment if you haven\'t started the program. Details are on our Refund Policy page.' },
  },
];

// Concatenation order MUST match apps/web/src/app/[locale]/faq/page.tsx allFaqs order:
//   about → methodology → programs → stce → coaching → corporate → family → booking
const ALL_FAQS: SourceFaqItem[] = [
  ...aboutFaqs,
  ...methodologyFaqs,
  ...programsFaqs,
  ...stceFaqs,
  ...coachingFaqs,
  ...corporateFaqs,
  ...familyFaqs,
  ...bookingFaqs,
];

// ── Build the static_pages row body ─────────────────────────────────────────
//
// faq_accordion items use FLAT bilingual fields (q_ar/q_en/a_ar/a_en) per
// section-vocabulary.ts default payload. We translate from the source nested
// `{ar:{q,a}, en:{q,a}}` shape here. JSON-LD auto-emits from the renderer
// (per Wave 4 PRECURSOR §7.6 design decision) — no need to set
// `seo_meta_json.faq_jsonld_enabled` flag.

interface FaqAccordionItem {
  q_ar: string;
  q_en: string;
  a_ar: string;
  a_en: string;
}

const items: FaqAccordionItem[] = ALL_FAQS.map((it) => ({
  q_ar: it.ar.q,
  q_en: it.en.q,
  a_ar: it.ar.a,
  a_en: it.en.a,
}));

const compositionJson = {
  // No top-level hero on the composition itself — the hero lives on
  // static_pages.hero_json (parity with landing_pages.hero_json shape per
  // PRECURSOR §7.7 design decision).
  sections: [
    {
      type: 'faq_accordion' as const,
      // No `title_*` — current /faq has no inner section heading. The
      // hero carries the page-level title.
      items,
      // `disable_jsonld` defaults to false → renderer auto-emits FAQPage
      // JSON-LD inline (preserves prior route's <script> JSON-LD behaviour).
    },
  ],
};

// Hero parity with the prior <PageHero> usage in apps/web/src/app/[locale]/faq/page.tsx
// hero_json is a free-form bag — schema is whatever the renderer reads.
// The static_pages page.tsx (Step 3) renders this manually using the existing
// PageHero component, so the field names match PageHero's props 1:1.
const heroJson = {
  // PageHero shape — same as landing_pages.hero_json convention.
  // We use NESTED `title_ar/title_en` etc to match the props the route
  // file's renderer will pass through.
  title_ar: 'الأسئلة الشائعة',
  title_en: 'Frequently Asked Questions',
  subtitle_ar: 'إجابات على الأسئلة الأكثر شيوعًا حول أكاديمية كُن وبرامجنا',
  subtitle_en: 'Answers to the most common questions about Kun Academy and our programs',
  eyebrow_ar: 'الدعم',
  eyebrow_en: 'Support',
  pattern: 'flower-of-life' as const,
};

// SEO parity with the prior generateMetadata() output in apps/web/src/app/[locale]/faq/page.tsx
const seoMetaJson = {
  meta_title_ar: 'الأسئلة الشائعة | أكاديمية كُن',
  meta_title_en: 'FAQ | Kun Academy',
  meta_description_ar: 'إجابات على الأسئلة الشائعة حول برامج أكاديمية كُن والشهادات والتسجيل',
  meta_description_en: 'Frequently asked questions about Kun coaching programs, certifications, and enrollment.',
};

// ── DDL emission ───────────────────────────────────────────────────────────
//
// One UPSERT row. Fields mirror the static_pages schema (packages/db/src/schema/static_pages.ts).
// `created_by_kind='system'` per the schema's allowed authorship-kind whitelist
// for migration / cron / seeder paths (created_by_id NULL in this case).
// Status='published' + published=true so the row is publicly readable on
// first deploy. The published<->status sync trigger keeps both columns
// consistent.

const SLUG = 'faq';
const KIND = 'static';

function escSqlString(s: string): string {
  // PG single-quote escaping. Used inside dollar-tagged blocks below to
  // avoid double-escape pain with embedded apostrophes in the text.
  return s.replace(/'/g, "''");
}

function emitSql(): string {
  // Use dollar-quoting for the JSONB literals to avoid quote-escape soup
  // on Arabic + English content with apostrophes ("you're", "we're", etc).
  const compTag = '$comp$';
  const heroTag = '$hero$';
  const seoTag = '$seo$';

  const compJson = JSON.stringify(compositionJson);
  const heroJsonStr = JSON.stringify(heroJson);
  const seoJsonStr = JSON.stringify(seoMetaJson);

  // Sanity: dollar tags must NOT appear inside the JSON. Validate.
  if (compJson.includes(compTag) || heroJsonStr.includes(heroTag) || seoJsonStr.includes(seoTag)) {
    throw new Error('JSON content contains a reserved dollar-quote tag — pick different tags.');
  }

  const now = new Date().toISOString();

  return `-- Generated by scripts/migrate-static-page-faq.ts — Wave 15 Wave 4 Route 1
-- Migrates /faq from hand-written JSX to a static_pages-backed row.
-- Idempotent: ON CONFLICT (slug) DO UPDATE replaces in place.

BEGIN;

INSERT INTO static_pages (
  slug,
  kind,
  composition_json,
  hero_json,
  seo_meta_json,
  status,
  published,
  published_at,
  launch_lock,
  created_by_kind,
  created_by_id,
  last_edited_by_kind,
  last_edited_by_id,
  last_edited_by_name,
  last_edited_at,
  created_at,
  updated_at
)
VALUES (
  '${escSqlString(SLUG)}',
  '${escSqlString(KIND)}',
  ${compTag}${compJson}${compTag}::jsonb,
  ${heroTag}${heroJsonStr}${heroTag}::jsonb,
  ${seoTag}${seoJsonStr}${seoTag}::jsonb,
  'published',
  true,
  '${now}',
  false,
  'system',
  NULL,
  'system',
  NULL,
  'wave-15-w4-r1-migrate-faq',
  '${now}',
  '${now}',
  '${now}'
)
ON CONFLICT (slug) DO UPDATE SET
  kind             = EXCLUDED.kind,
  composition_json = EXCLUDED.composition_json,
  hero_json        = EXCLUDED.hero_json,
  seo_meta_json    = EXCLUDED.seo_meta_json,
  -- Status flip: only force-publish if the existing row is still draft.
  -- Once an admin has it in review/published/archived, leave their workflow alone.
  status           = CASE
                       WHEN static_pages.status = 'draft' THEN 'published'
                       ELSE static_pages.status
                     END,
  -- published mirrors status via the sync trigger; we still write the boolean
  -- so that the publish window is preserved for the initial seed without
  -- relying on the trigger ordering.
  published        = (CASE
                        WHEN static_pages.status = 'draft' THEN true
                        ELSE static_pages.published
                      END),
  published_at     = COALESCE(static_pages.published_at, EXCLUDED.published_at),
  -- Last-edit audit fields always update on re-run.
  last_edited_by_kind = 'system',
  last_edited_by_id   = NULL,
  last_edited_by_name = 'wave-15-w4-r1-migrate-faq',
  last_edited_at      = EXCLUDED.last_edited_at,
  updated_at          = EXCLUDED.updated_at;

COMMIT;
`;
}

// ── Apply paths ────────────────────────────────────────────────────────────

async function applyViaDb(dbUrl: string): Promise<{ rowCount: number; row: Record<string, unknown> }> {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    const sql = emitSql();
    // Strip the inner BEGIN/COMMIT — we already opened a txn.
    const body = sql.replace(/^BEGIN;\n/m, '').replace(/\nCOMMIT;\n?$/m, '');
    await client.query(body);
    const verify = await client.query(
      `SELECT id, slug, kind, status, published,
              jsonb_array_length(composition_json -> 'sections') AS section_count,
              jsonb_array_length(composition_json -> 'sections' -> 0 -> 'items') AS item_count
         FROM static_pages
        WHERE slug = $1
        LIMIT 1`,
      [SLUG],
    );
    await client.query('COMMIT');
    return { rowCount: verify.rowCount ?? 0, row: verify.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const emitSqlPath = process.env.EMIT_SQL;
  const dbUrl = process.env.DATABASE_URL;
  if (!dryRun && !emitSqlPath && !dbUrl) {
    console.error('ERROR: DATABASE_URL required (or DRY_RUN=1 / EMIT_SQL=<path>)');
    process.exit(1);
  }

  console.log(`[migrate-static-page-faq] Source: 8 used FAQ collections inlined from data/faqs.ts`);
  console.log(`[migrate-static-page-faq]   total items: ${ALL_FAQS.length} (${aboutFaqs.length} about + ${methodologyFaqs.length} methodology + ${programsFaqs.length} programs + ${stceFaqs.length} stce + ${coachingFaqs.length} coaching + ${corporateFaqs.length} corporate + ${familyFaqs.length} family + ${bookingFaqs.length} booking)`);

  if (emitSqlPath) {
    const sql = emitSql();
    writeFileSync(emitSqlPath, sql, 'utf-8');
    console.log(`\n[migrate-static-page-faq] EMIT_SQL → wrote ${sql.length} bytes to ${emitSqlPath}`);
    console.log(`Apply with: sudo -u postgres psql kunacademy -f ${emitSqlPath}`);
    return;
  }

  if (dryRun) {
    const sql = emitSql();
    console.log(`\n[migrate-static-page-faq] DRY_RUN=1 — would emit ${sql.length} bytes of SQL.`);
    console.log(`First 4 items:`);
    items.slice(0, 4).forEach((it, i) => {
      console.log(`  ${i}. AR Q: ${it.q_ar.slice(0, 60)}${it.q_ar.length > 60 ? '…' : ''}`);
      console.log(`     EN Q: ${it.q_en.slice(0, 60)}${it.q_en.length > 60 ? '…' : ''}`);
    });
    return;
  }

  if (dbUrl) {
    console.log('\n[migrate-static-page-faq] Connecting to DB...');
    const result = await applyViaDb(dbUrl);
    console.log(`\n[migrate-static-page-faq] Migration complete.`);
    console.log(`  rowCount:      ${result.rowCount}`);
    console.log(`  row.id:        ${result.row?.id}`);
    console.log(`  row.slug:      ${result.row?.slug}`);
    console.log(`  row.kind:      ${result.row?.kind}`);
    console.log(`  row.status:    ${result.row?.status}`);
    console.log(`  row.published: ${result.row?.published}`);
    console.log(`  sections:      ${result.row?.section_count}`);
    console.log(`  items:         ${result.row?.item_count}`);
  }
}

main().catch((err) => {
  console.error('[migrate-static-page-faq] FAILED:', err);
  process.exit(1);
});
