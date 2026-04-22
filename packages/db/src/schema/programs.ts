import {
  pgTable,
  boolean,
  text,
  timestamp,
  uuid,
  integer,
  date,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * CMS→DB Phase 2d — programs table.
 *
 * Replaces the CMS `programs` sheet. See migration
 * 0036_cms_phase2d_programs.sql for the DDL rationale + CHECK constraints.
 *
 * `nav_group`, `type`, `format`, `status` are enforced at the DB via CHECK.
 * Drizzle types them as plain `text` — the CMS `Program` type in
 * packages/cms/src/types.ts carries the narrow TypeScript union.
 */
export const programs = pgTable(
  'programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),

    // Bilingual identity
    title_ar: text('title_ar').notNull(),
    title_en: text('title_en').notNull(),
    subtitle_ar: text('subtitle_ar'),
    subtitle_en: text('subtitle_en'),
    description_ar: text('description_ar'),
    description_en: text('description_en'),

    // Taxonomy
    nav_group: text('nav_group').notNull(),
    type: text('type').notNull(),
    format: text('format').notNull().default('online'),
    status: text('status').notNull().default('active'),
    category: text('category'),
    parent_code: text('parent_code'),

    // People + place
    instructor_slug: text('instructor_slug'),
    location: text('location'),

    // Timing
    duration: text('duration'),
    next_start_date: date('next_start_date'),
    enrollment_deadline: date('enrollment_deadline'),
    access_duration_days: integer('access_duration_days'),

    // Pricing
    price_aed: numeric('price_aed', { precision: 10, scale: 2 }),
    price_egp: numeric('price_egp', { precision: 10, scale: 2 }),
    price_usd: numeric('price_usd', { precision: 10, scale: 2 }),
    price_eur: numeric('price_eur', { precision: 10, scale: 2 }),
    early_bird_price_aed: numeric('early_bird_price_aed', { precision: 10, scale: 2 }),
    early_bird_deadline: date('early_bird_deadline'),
    discount_percentage: numeric('discount_percentage', { precision: 5, scale: 2 }),
    discount_valid_until: date('discount_valid_until'),
    installment_enabled: boolean('installment_enabled').notNull().default(false),
    bundle_id: text('bundle_id'),

    // ICF / CCE
    is_icf_accredited: boolean('is_icf_accredited').notNull().default(false),
    icf_details: text('icf_details'),
    cce_units: numeric('cce_units', { precision: 6, scale: 2 }),

    // Visual
    hero_image_url: text('hero_image_url'),
    thumbnail_url: text('thumbnail_url'),
    program_logo: text('program_logo'),
    promo_video_url: text('promo_video_url'),
    // Canon W3-A (migration 0049) — gallery + closing band
    gallery_json: jsonb('gallery_json'),
    closing_bg_url: text('closing_bg_url'),

    // Pathways
    prerequisite_codes: text('prerequisite_codes').array().notNull().default([]),
    pathway_codes: text('pathway_codes').array().notNull().default([]),

    // Rich blobs
    curriculum_json: jsonb('curriculum_json'),
    faq_json: jsonb('faq_json'),
    journey_stages: text('journey_stages'),
    materials_folder_url: text('materials_folder_url'),
    content_doc_id: text('content_doc_id'),

    // SEO
    meta_title_ar: text('meta_title_ar'),
    meta_title_en: text('meta_title_en'),
    meta_description_ar: text('meta_description_ar'),
    meta_description_en: text('meta_description_en'),
    og_image_url: text('og_image_url'),

    // Flags
    is_featured: boolean('is_featured').notNull().default(false),
    is_free: boolean('is_free').notNull().default(false),

    // ── Canon Phase 2 extensions (migration 0039) ──────────────────────────
    // All nullable / defaulted to preserve backward compatibility with the
    // 34 Phase 2d seeded rows. Enum widenings (nav_group `family`,
    // type `service`) are enforced via refreshed CHECK constraints in 0038.
    cross_list_nav_groups: text('cross_list_nav_groups').array().notNull().default([]),
    delivery_formats: text('delivery_formats').array().notNull().default([]),
    individually_bookable: boolean('individually_bookable'),
    delivery_certification_required: boolean('delivery_certification_required'),
    grants_delivery_license: text('grants_delivery_license'),
    concept_by: text('concept_by'),
    cta_type: text('cta_type'),
    durations_offered: jsonb('durations_offered'),
    pricing_by_duration: jsonb('pricing_by_duration'),
    track_color: text('track_color'),
    delivery_notes: text('delivery_notes'),

    // Ordering + lifecycle
    display_order: integer('display_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
    published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),

    last_edited_by: uuid('last_edited_by').references(() => profiles.id),
    last_edited_at: timestamp('last_edited_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugUidx: uniqueIndex('programs_slug_uidx').on(t.slug),
    navGroupIdx: index('programs_nav_group_idx').on(t.nav_group),
    typeIdx: index('programs_type_idx').on(t.type),
    categoryIdx: index('programs_category_idx').on(t.category),
    publishedIdx: index('programs_published_idx').on(t.published),
    displayOrderIdx: index('programs_display_order_idx').on(t.display_order),
    isFeaturedIdx: index('programs_is_featured_idx').on(t.is_featured),
  }),
);

export type ProgramRow = typeof programs.$inferSelect;
export type NewProgramRow = typeof programs.$inferInsert;
