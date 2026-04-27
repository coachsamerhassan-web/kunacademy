/**
 * Wave 15 Wave 3 — Section vocabulary registry.
 *
 * Per spec §3c: 8 universal section types (mirror, header, body, cta, image,
 * video, quote, divider). Each entry has:
 *   - id (matches LpSectionType for landing carry-forward where applicable)
 *   - label_ar / label_en (display in picker + tree)
 *   - icon (single emoji glyph for picker thumbnails)
 *   - default-empty payload (for "+Add section")
 *   - applicableEntities (which sibling tables the type can live in)
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
    applicableEntities: ['landing_pages', 'blog_posts', 'static_pages'],
    defaultPayload: () => ({ type: 'divider' }),
  },
  {
    id: 'mirror',
    label_ar: 'مرآة',
    label_en: 'Mirror',
    icon: '🪞',
    description_ar: 'قسم المرآة (لصفحات الهبوط — مغطّى بنموذج LP المخصّص)',
    description_en: 'Mirror section (for LPs — uses dedicated LP form).',
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
