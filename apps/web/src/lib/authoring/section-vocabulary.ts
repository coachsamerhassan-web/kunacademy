/**
 * Wave 15 Wave 3 — Section vocabulary registry.
 *
 * Per spec §3c: 8 universal section types (mirror, header, body, cta, image,
 * video, quote, divider). Each entry has:
 *   - id (matches LpSectionType for landing carry-forward where applicable)
 *   - label_ar / label_en (display in picker + tree)
 *   - icon (single emoji glyph for picker thumbnails)
 *   - description_ar / description_en (1-line clarifier per WP Inserter
 *     pattern — see WP UX research §8 in
 *     `Workspace/CTO/output/2026-04-28-wp-ux-research.md`).
 *   - default-empty payload (for "+Add section")
 *   - applicableEntities (which sibling tables the type can live in)
 *
 * Canary v2 (2026-04-28) addition: Issue 7 — Section labels + descriptions.
 * Descriptions for all section types are EN-default placeholders ready for
 * Samer review. The full draft list (universals + 15 LP types) ships at
 * `Project Memory/KUN-Features/Workspace/CTO/output/2026-04-28-section-descriptions-DRAFT.md`
 * for Samer to revise before final lock-in. Methodology language is HIS voice;
 * we ship sensible defaults so the editor isn't blank.
 *
 * Wave 3 ships the 8 universal subset (per §8 Wave 3 phasing). Wave 14b's
 * 15 LP section types remain authorable via the existing `forms/{type}.tsx`
 * components mounted from the side panel — the registry below is the
 * authoritative SOURCE for the picker; it does NOT retire the 15 LP types
 * (those retire in Wave 4 per spec §3b carry-forward inventory).
 *
 * Authoring contract: the side panel renders the LP form component for any
 * section whose `type` is one of the 15 carry-forward LP types; for the 8
 * universal types this file's `formComponentName` indicates which generic
 * universal form to mount (built in Wave 3 minimal form set).
 *
 * Carry-forward integrity: this registry CO-EXISTS with `_shared.tsx`'s
 * `SECTION_TYPE_LABELS` and `SECTION_TYPES_ORDERED` for the 15 LP types.
 * Adding a new universal type = add an entry here + a generic form. NO
 * change to the 15 LP form files.
 */

import type { LpSectionType } from '@/lib/lp/composition-types';

/** Entity targets a section type can live in. */
export type EntityTarget = 'landing_pages' | 'blog_posts' | 'static_pages';

/** Universal section type ids. Distinct namespace from LpSectionType so we
 *  can co-exist; renderers / forms dispatch by checking universal first. */
export type UniversalSectionType =
  | 'header'
  | 'body'
  | 'image'
  | 'video'
  | 'quote'
  | 'divider'
  // mirror + cta are also LP types (form already shipped); we duplicate the
  // id here so the picker can list them under the universal grouping for
  // non-LP entities (blog_posts + static_pages get a thin proxy form).
  | 'mirror'
  | 'cta';

export interface SectionVocabularyEntry {
  /** Section type id. Matches the discriminator in section.type. */
  id: UniversalSectionType;
  label_ar: string;
  label_en: string;
  /** Emoji glyph used in the section type picker thumbnails. */
  icon: string;
  /** Short author-facing description (one line). */
  description_ar: string;
  description_en: string;
  /** Brief illustrative example (shown below description in picker). */
  example_ar: string;
  example_en: string;
  /** Which sibling entities can host this section type. */
  applicableEntities: ReadonlyArray<EntityTarget>;
  /** Default empty payload — written to composition_json when admin clicks
   *  "+Add" for this type. Each shape is permissive (all fields optional). */
  defaultPayload: () => Record<string, unknown>;
}

export const UNIVERSAL_SECTION_VOCABULARY: ReadonlyArray<SectionVocabularyEntry> = [
  {
    id: 'header',
    label_ar: 'عنوان',
    label_en: 'Header',
    icon: '📰',
    description_ar: 'عنوان رئيسي + ترويسة فرعية',
    description_en: 'Title + subtitle headline pair.',
    example_ar: 'أنت تشعر بالتوقّف — هذه الممارسة التي حرّكت ٥٠ مدرّباً',
    example_en: 'You feel stuck. Here\'s the practice that moved 50 coaches forward.',
    applicableEntities: ['landing_pages', 'blog_posts', 'static_pages'],
    defaultPayload: () => ({ type: 'header', title_ar: '', title_en: '', subtitle_ar: '', subtitle_en: '' }),
  },
  {
    id: 'body',
    label_ar: 'نصّ',
    label_en: 'Body text',
    icon: '📄',
    description_ar: 'فقرة طويلة بلغتين، نصّ غنيّ',
    description_en: 'Long-form bilingual rich text body.',
    example_ar: 'فقرة من ٢٠٠ كلمة عن لماذا يترك المدرّبون نماذج التدريب التقليدية',
    example_en: 'A 200-word reflection on why coaches leave traditional training models.',
    applicableEntities: ['landing_pages', 'blog_posts', 'static_pages'],
    defaultPayload: () => ({ type: 'body', body_ar: '', body_en: '' }),
  },
  {
    id: 'image',
    label_ar: 'صورة',
    label_en: 'Image',
    icon: '🖼',
    description_ar: 'صورة مع نصّ بديل وتسمية اختيارية',
    description_en: 'Image with required alt text + optional caption.',
    example_ar: 'صورة مدرّب أثناء تمرين حسّي مع متدرّبه',
    example_en: 'A coach mid-practice with a client during somatic work.',
    applicableEntities: ['landing_pages', 'blog_posts', 'static_pages'],
    defaultPayload: () => ({
      type: 'image',
      image_url: '',
      alt_ar: '',
      alt_en: '',
      caption_ar: '',
      caption_en: '',
    }),
  },
  {
    id: 'video',
    label_ar: 'فيديو',
    label_en: 'Video embed',
    icon: '🎬',
    description_ar: 'فيديو من قائمة موثوقة (يوتيوب / فيميو / لووم)',
    description_en: 'Video from allowlisted host (YouTube / Vimeo / Loom).',
    example_ar: 'فيديو يوتيوب من ٣ دقائق يشرح الممارسة',
    example_en: 'A 3-minute YouTube intro explaining the practice.',
    applicableEntities: ['landing_pages', 'blog_posts', 'static_pages'],
    defaultPayload: () => ({ type: 'video', embed_url: '', caption_ar: '', caption_en: '' }),
  },
  {
    id: 'quote',
    label_ar: 'اقتباس',
    label_en: 'Pull quote',
    icon: '❝',
    description_ar: 'اقتباس بارز مع توقيع المصدر',
    description_en: 'Highlighted quotation with attribution.',
    example_ar: 'أخيراً عرفتُ ما الذي يخدمه التدريب — ليلى، دفعة ٢٠٢٤',
    example_en: 'I finally know what coaching is FOR. — Layla, 2024 cohort',
    applicableEntities: ['landing_pages', 'blog_posts', 'static_pages'],
    defaultPayload: () => ({
      type: 'quote',
      quote_ar: '',
      quote_en: '',
      attribution_ar: '',
      attribution_en: '',
    }),
  },
  {
    id: 'divider',
    label_ar: 'فاصل',
    label_en: 'Divider',
    icon: '➖',
    description_ar: 'خطّ فاصل بصري',
    description_en: 'Visual horizontal divider.',
    example_ar: 'بين بيت المنهج وبيت اللوجستيات',
    example_en: 'Between methodology beats and logistics.',
    applicableEntities: ['landing_pages', 'blog_posts', 'static_pages'],
    defaultPayload: () => ({ type: 'divider' }),
  },
  {
    id: 'mirror',
    label_ar: 'مرآة',
    label_en: 'Mirror',
    icon: '🪞',
    description_ar: 'قسم المرآة — قراءة دقيقة لتجربة القارئ الراهنة',
    description_en: 'Mirror section — a precise read of the reader\'s present experience',
    example_ar: 'كلّ الكتب، كلّ الشهادات، ولا تزال تتساءل داخل الجلسة',
    example_en: 'Every book, every certification — and still uncertain inside the room.',
    applicableEntities: ['landing_pages'],
    defaultPayload: () => ({ type: 'mirror', kicker_ar: '', kicker_en: '', title_ar: '', title_en: '' }),
  },
  {
    id: 'cta',
    label_ar: 'دعوة للفعل',
    label_en: 'CTA',
    icon: '🎯',
    description_ar: 'دعوة للفعل + زرّ',
    description_en: 'Call-to-action with button.',
    example_ar: 'تقدّم لدفعة ٢٠٢٦ ←',
    example_en: 'Apply for the 2026 cohort →',
    applicableEntities: ['landing_pages', 'blog_posts', 'static_pages'],
    defaultPayload: () => ({
      type: 'cta',
      title_ar: '',
      title_en: '',
      cta_label_ar: '',
      cta_label_en: '',
      cta_anchor: '',
    }),
  },
];

/** Map section type → vocabulary entry. */
export const VOCAB_BY_ID: Record<string, SectionVocabularyEntry> = Object.fromEntries(
  UNIVERSAL_SECTION_VOCABULARY.map((e) => [e.id, e]),
);

/** All LpSectionType values from Wave 14b — picker shows these for landing_pages
 *  alongside the universals (de-duplicating mirror + cta which appear in both). */
export const LP_SECTION_TYPES_ORDERED: ReadonlyArray<LpSectionType> = [
  'mirror',
  'reframe',
  'description',
  'benefits',
  'carry_out',
  'who_for',
  'who_not_for',
  'format',
  'price',
  'group_alumni',
  'credibility',
  'objections',
  'faq',
  'cta',
  'custom',
];

/**
 * Wave 15 Wave 3 canary v2 — LP-type descriptions registry.
 *
 * Maps each of the 15 carry-forward LpSectionType values to a Title-Case
 * label + 1-2 sentence description. Used by the section picker (when a
 * landing_page entity is being edited) and by the side panel header strip.
 *
 * These are EN-default placeholders pending Samer's voice revision at the
 * canary v2 review boundary. Full draft + AR translations live at
 * `Workspace/CTO/output/2026-04-28-section-descriptions-DRAFT.md` —
 * `replace these with Samer's revised copy` before Wave 4 lock-in.
 *
 * The AR strings here are Hakima/Hakawati's natural-voice short captions;
 * the EN strings are bridging copy. None are methodology-recipe language
 * (per CLAUDE.md IP rule R2). They describe the FUNCTION + USE-WHEN.
 */
export interface LpTypeDescription {
  label_ar: string;
  label_en: string;
  icon: string;
  description_ar: string;
  description_en: string;
  example_ar: string;
  example_en: string;
}

export const LP_TYPE_DESCRIPTIONS: Record<LpSectionType, LpTypeDescription> = {
  mirror: {
    label_ar: 'مرآة',
    label_en: 'Mirror',
    icon: '🪞',
    description_ar: 'تعكس على القارئ تجربته الحالية بدقّة. استخدمها كأوّل قسم بعد البطل.',
    description_en: 'Reflect the reader\'s current experience back to them precisely. Use as the first section after the hero.',
    example_ar: 'كلّ الكتب، كلّ الشهادات، ولا تزال تتساءل داخل الجلسة',
    example_en: 'Every book, every certification — and still uncertain inside the room.',
  },
  reframe: {
    label_ar: 'إعادة تأطير',
    label_en: 'Reframe',
    icon: '🔄',
    description_ar: 'تحوّل من المشكلة إلى منظور جديد. تأتي بعد المرآة عادةً.',
    description_en: 'Pivot from the problem to a new perspective. Typically follows the mirror.',
    example_ar: 'المسألة ليست فيما لا تعرف، بل في انتظار الجسد للإذن بالقيادة',
    example_en: 'The question isn\'t what you don\'t know. It\'s the body waiting for permission to lead.',
  },
  description: {
    label_ar: 'الوصف',
    label_en: 'Description',
    icon: '📝',
    description_ar: 'وصف ما هو البرنامج أو الفعالية بنصّ ثري متواصل.',
    description_en: 'Long-form description of what the program or event is.',
    example_ar: 'نظرة عامة من ٣٠٠ كلمة على بنية Pathfinder عبر ٦ أشهر',
    example_en: 'A 300-word overview of Pathfinder\'s 6-month structure.',
  },
  benefits: {
    label_ar: 'الفوائد',
    label_en: 'Benefits',
    icon: '✨',
    description_ar: 'قائمة فوائد قصيرة بأسلوب نقطيّ مع أيقونات اختيارية.',
    description_en: 'Bulleted list of benefits with optional icons.',
    example_ar: 'انتقال من اتباع السكربت إلى الحضور الحسّي · إيجاد توقيعك المميّز كمدرّب',
    example_en: 'Move from script-following to embodied presence · Find your signature as a coach.',
  },
  carry_out: {
    label_ar: 'ما تحمله معك',
    label_en: 'Carry-Out',
    icon: '🎒',
    description_ar: 'ما الذي يأخذه القارئ معه عند الانتهاء — ملموس ومحدّد.',
    description_en: 'What the reader takes with them when they finish — tangible and specific.',
    example_ar: 'ممارسة حسّية يوميّة من ٥ دقائق · مجموعة من ١٢ زميلاً تبقى لسنوات',
    example_en: 'A daily 5-minute somatic practice · A cohort of 12 colleagues you keep for years.',
  },
  who_for: {
    label_ar: 'لمن',
    label_en: 'Who For',
    icon: '👥',
    description_ar: 'من هم المعنيون بهذا — قائمة مؤهّلة بصدق.',
    description_en: 'Who this is for — a list that qualifies honestly.',
    example_ar: 'مدرّبون لديهم أكثر من ١٠٠ ساعة مدفوعة ويشعرون بالتشبّع المنهجيّ',
    example_en: 'Coaches with 100+ paid hours who feel methodology-saturated.',
  },
  who_not_for: {
    label_ar: 'ليس لمن',
    label_en: 'Who Not For',
    icon: '🚫',
    description_ar: 'من لا يجد قيمته هنا — قائمة قصيرة وحادّة.',
    description_en: 'Who will not find value here — short and sharp.',
    example_ar: 'من يبحث عن أوّل أدواته، أو عن شهادة سريعة',
    example_en: 'Anyone looking for their first toolkit, or a quick certification.',
  },
  format: {
    label_ar: 'الشكل',
    label_en: 'Format',
    icon: '📅',
    description_ar: 'اللوجستيات — التواريخ والمواعيد والأمكنة والوسيلة (حضوري / أونلاين).',
    description_en: 'Logistics — dates, times, location, and modality (in-person / online).',
    example_ar: '٦ أشهر · زووم أسبوعي ٩٠ دقيقة + خلوتان حضوريتان · دبي أو القاهرة',
    example_en: '6 months · weekly 90-min Zoom + 2 in-person retreats · Dubai or Cairo.',
  },
  price: {
    label_ar: 'السعر',
    label_en: 'Price',
    icon: '💰',
    description_ar: 'الاستثمار في الفرصة، مع شرائح مبكر/عاديّ/متأخّر اختيارية.',
    description_en: 'Investment in the opportunity, with optional early/regular/late tiers.',
    example_ar: 'تسجيل مبكّر ١٢،٠٠٠ درهم (حتى ١ مايو) · عاديّ ١٥،٠٠٠ · متأخّر ١٨،٠٠٠',
    example_en: 'Early bird AED 12,000 (until 1 May) · Regular 15,000 · Standard 18,000.',
  },
  group_alumni: {
    label_ar: 'مجموعة + خرّيجون',
    label_en: 'Group + Alumni',
    icon: '🎓',
    description_ar: 'هويّة المجموعة وأصواتُ خرّيجين سابقين.',
    description_en: 'The group identity + voices from past alumni.',
    example_ar: '٢٠ مدرّباً في الدفعة · خرّيجون من ٤ قارّات · مدن المرتكز: دبي، القاهرة، لندن',
    example_en: '20 coaches per cohort · alumni from 4 continents · Dubai-Cairo-London anchor cities.',
  },
  credibility: {
    label_ar: 'المصداقية',
    label_en: 'Credibility',
    icon: '🏆',
    description_ar: 'سيرة المعلّم/المدرّب وما يجعله مؤهّلًا — موجز.',
    description_en: 'The teacher\'s background and qualification — concise.',
    example_ar: 'سامر حسن — أوّل مدرّب عربيّ يحمل MCC، درّب ٥٠٠+ مدرّباً بثلاث لغات',
    example_en: 'Samer Hassan — first Arab MCC, 500+ coaches trained across 3 languages.',
  },
  objections: {
    label_ar: 'الاعتراضات',
    label_en: 'Objections',
    icon: '⚖️',
    description_ar: 'مواجهة المخاوف الحقيقية للقارئ بصدق وبدون مراوغة.',
    description_en: 'Address the reader\'s real hesitations honestly, no dodging.',
    example_ar: 'أنا مشغول ← ٤ ساعات أسبوعياً تكفي · لا أتكلم العربية ← دفعة بالإنكليزية بالتوازي',
    example_en: 'I\'m too busy → 4 hrs/week is enough · I don\'t speak Arabic → English cohort in parallel.',
  },
  faq: {
    label_ar: 'أسئلة شائعة',
    label_en: 'FAQ',
    icon: '❓',
    description_ar: 'أسئلة لوجستيّة شائعة وأجوبتها — سؤال/جواب.',
    description_en: 'Common logistical questions and their answers.',
    example_ar: 'هل أحصل على شهادة؟ · هل يمكن الدفع على دفعات؟ · ماذا لو فاتتني جلسة؟',
    example_en: 'Will I get a certificate? · Can I pay in installments? · What if I miss a session?',
  },
  cta: {
    label_ar: 'دعوة للفعل',
    label_en: 'Call to Action',
    icon: '🎯',
    description_ar: 'دعوة واضحة للفعل التالي — تسجيل، موعد، استفسار.',
    description_en: 'A clear call to next action — register, schedule, inquire.',
    example_ar: 'تقدّم لدفعة ٢٠٢٦ ←',
    example_en: 'Apply for the 2026 cohort →',
  },
  custom: {
    label_ar: 'مخصّص',
    label_en: 'Custom',
    icon: '✨',
    description_ar: 'قسم حرّ لمحتوى لا يندرج تحت الأنواع الأخرى.',
    description_en: 'Open-ended section for content that doesn\'t fit other types.',
    example_ar: 'إعلان خاصّ، صفحة تكريم، أو محتوى لا يندرج تحت غيره',
    example_en: 'A special announcement, a tribute page, or content that doesn\'t fit other types.',
  },
};

/** Filter vocabulary by entity. Used by the section type picker per
 *  Hakawati §5.2 (per-page-kind filtering — hide non-applicable types). */
export function vocabularyForEntity(entity: EntityTarget): ReadonlyArray<SectionVocabularyEntry> {
  return UNIVERSAL_SECTION_VOCABULARY.filter((e) => e.applicableEntities.includes(entity));
}

/** Resolve a section's display label given its `type`. Falls back to the
 *  literal type when neither registry has it (defensive — should never fire
 *  on a well-formed composition_json). */
export function sectionLabel(type: string, isAr: boolean): string {
  const universal = VOCAB_BY_ID[type];
  if (universal) return isAr ? universal.label_ar : universal.label_en;
  // Fall back to the LP type labels carried forward in _shared.tsx — those
  // are imported by the side panel directly. Here we just return the raw
  // type token; the side panel resolves prettier labels.
  return type;
}
