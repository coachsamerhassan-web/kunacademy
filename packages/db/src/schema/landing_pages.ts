import { pgTable, boolean, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './profiles';
import { programs } from './programs';

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
  // Optional program link — TEXT kept for backwards compat.
  program_slug: text("program_slug"),
  // Real FK added in migration 0037 (Phase 2d). ON DELETE SET NULL.
  program_id: uuid("program_id").references(() => programs.id, { onDelete: 'set null' }),
  // { [section]: { [key]: { ar, en } } } — matches cms/types.ts PageSections
  sections_json: jsonb("sections_json").notNull().default({}),
  // Landing/hero fields: { hero_image_url, cta_text_ar/en, cta_url, form_embed }
  hero_json: jsonb("hero_json").notNull().default({}),
  // { meta_title_ar/en, meta_description_ar/en, og_image_url, canonical_url }
  seo_meta_json: jsonb("seo_meta_json").notNull().default({}),
  // ── Wave 14 LP-INFRA (migration 0052) ──────────────────────────────────
  // When true, this LP is reachable even when LAUNCH_MODE=landing-only.
  launch_lock: boolean("launch_lock").notNull().default(false),
  // Multi-section composition (richer than sections_json). NULL = use legacy
  // hero+body+CTA renderer at /landing/[slug]. New /lp/[slug] route requires this.
  composition_json: jsonb("composition_json"),
  // { enabled, fields[], required_fields[], success_redirect?, zoho_lead_source?, consent_text_{ar,en}? }
  lead_capture_config: jsonb("lead_capture_config"),
  // { enabled, currencies[], tiers[], group_codes[], alumni_unlock_early_bird }
  // Schema only — payment widget wiring deferred to LP-INFRA-B.
  payment_config: jsonb("payment_config"),
  // { ga4_id?, meta_pixel_id?, tiktok_pixel_id?, conversion_event_name? }
  analytics_config: jsonb("analytics_config"),
  published: boolean("published").notNull().default(true),
  published_at: timestamp("published_at", { withTimezone: true, mode: 'string' }),
  last_edited_by: uuid("last_edited_by").references(() => profiles.id),
  last_edited_at: timestamp("last_edited_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  // ── Wave 15 Wave 1 (migration 0066) ────────────────────────────────────
  // Status state machine. CHECK in {'draft','review','published','archived'}
  // at DB level. `published` boolean is mirrored via the sync trigger; write
  // status, not published.
  status: text("status").notNull().default('draft'),
  // When set + status='review', the publish-cron flips status='published'
  // at or after this time (Wave 15 D13).
  scheduled_publish_at: timestamp("scheduled_publish_at", { withTimezone: true, mode: 'string' }),
  // Authorship discriminator for last_edited_by. CHECK in
  // {'human','agent','system'} at DB level.
  // - 'human'  → last_edited_by uuid resolves to profiles.id (existing FK)
  // - 'agent'  → last_edited_by uuid resolves to agent_tokens.id (no FK; polymorphic)
  // - 'system' → last_edited_by is NULL
  last_edited_by_kind: text("last_edited_by_kind").notNull().default('human'),
  last_edited_by_name: text("last_edited_by_name"),
}, (t) => ({
  slugIdx: index("landing_pages_slug_idx").on(t.slug),
  programSlugIdx: index("landing_pages_program_slug_idx").on(t.program_slug),
  programIdIdx: index("landing_pages_program_id_idx").on(t.program_id),
  publishedIdx: index("landing_pages_published_idx").on(t.published),
  pageTypeIdx: index("landing_pages_page_type_idx").on(t.page_type),
  // ── Wave 15 Wave 1 indexes ────────────────────────────────────────────
  statusIdx: index("landing_pages_status_idx").on(t.status),
  scheduledIdx: index("landing_pages_scheduled_idx")
    .on(t.scheduled_publish_at)
    .where(sql`${t.scheduled_publish_at} IS NOT NULL`),
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
