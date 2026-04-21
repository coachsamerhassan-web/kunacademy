import { pgTable, boolean, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * CMS→DB Phase 2c — landing_pages
 *
 * Replaces the CMS `page-content` sheet + the `getLandingPages()` surface.
 * One row per page slug; sections_json holds the full PageSections shape:
 *   { [section]: { [key]: { ar, en } } }
 *
 * See migration 0035_cms_phase2c_landing_pages.sql for the full rationale.
 */
export const landing_pages = pgTable("landing_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  // 'page' | 'landing' | 'legal'  (CHECK constraint enforced at DB level)
  page_type: text("page_type").notNull().default('page'),
  // Optional program link — FK deferred until Phase 2d creates programs table.
  program_slug: text("program_slug"),
  // { [section]: { [key]: { ar, en } } } — matches cms/types.ts PageSections
  sections_json: jsonb("sections_json").notNull().default({}),
  // Landing/hero fields: { hero_image_url, cta_text_ar/en, cta_url, form_embed }
  hero_json: jsonb("hero_json").notNull().default({}),
  // { meta_title_ar/en, meta_description_ar/en, og_image_url, canonical_url }
  seo_meta_json: jsonb("seo_meta_json").notNull().default({}),
  published: boolean("published").notNull().default(true),
  published_at: timestamp("published_at", { withTimezone: true, mode: 'string' }),
  last_edited_by: uuid("last_edited_by").references(() => profiles.id),
  last_edited_at: timestamp("last_edited_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  slugIdx: index("landing_pages_slug_idx").on(t.slug),
  programSlugIdx: index("landing_pages_program_slug_idx").on(t.program_slug),
  publishedIdx: index("landing_pages_published_idx").on(t.published),
  pageTypeIdx: index("landing_pages_page_type_idx").on(t.page_type),
}));

export type LandingPage = typeof landing_pages.$inferSelect;
export type NewLandingPage = typeof landing_pages.$inferInsert;

/** Section bundle shape stored in sections_json */
export type PageSectionsJson = Record<string, Record<string, { ar: string; en: string }>>;

/** SEO metadata shape stored in seo_meta_json */
export interface PageSeoJson {
  meta_title_ar?: string;
  meta_title_en?: string;
  meta_description_ar?: string;
  meta_description_en?: string;
  og_image_url?: string;
  canonical_url?: string;
}

/** Landing hero/CTA shape stored in hero_json */
export interface PageHeroJson {
  hero_image_url?: string;
  cta_text_ar?: string;
  cta_text_en?: string;
  cta_url?: string;
  form_embed?: string;
}
