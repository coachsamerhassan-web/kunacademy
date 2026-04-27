import { pgTable, boolean, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Wave 15 Wave 1 — static_pages
 *
 * Sibling of `landing_pages`. Same JSONB composition shape (`composition_json`,
 * `hero_json`, `seo_meta_json`); different routing + lint scope. Discriminated
 * by `kind` column to serve four editorial kinds in one table:
 *   - 'static'             (default — /about, /contact, /faq, /team)
 *   - 'program_detail'     (author-able body for /programs/[slug])
 *   - 'methodology_essay'  (Hakima IP-sensitive lane)
 *   - 'portal_page'        (member-area static content)
 *
 * Per Wave 15 §2.1 sibling-tables architecture: this is NOT a unification of
 * landing_pages — it is a parallel surface for content that is not a landing
 * page but is also not a blog post. landing_pages stays untouched.
 *
 * Status state machine (column `status`): draft → review → published →
 * archived. Backwards-compat boolean `published` is mirrored from status via
 * a BEFORE INSERT/UPDATE trigger.
 *
 * Append-only audit lives in `content_edits` (entity='static_pages'); page-
 * level snapshots in `content_page_snapshots`.
 *
 * See migration 0065_wave_15_w1_static_pages.sql for the full DDL.
 */
export const static_pages = pgTable('static_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),

  // Editorial kind — discriminates the same row shape into four kinds.
  // CHECK in {'static','program_detail','methodology_essay','portal_page'}
  // enforced at DB level (static_pages_kind_chk).
  kind: text('kind').notNull().default('static'),

  // Body composition — matches landing_pages.composition_json shape.
  // Same `LpComposition` TS type (lib/lp/composition-types.ts).
  composition_json: jsonb('composition_json').default({}),

  // Hero/CTA bundle — matches landing_pages.hero_json shape.
  hero_json: jsonb('hero_json').default({}),

  // SEO bundle — matches landing_pages.seo_meta_json shape.
  seo_meta_json: jsonb('seo_meta_json').default({}),

  // Status state machine. CHECK in {'draft','review','published','archived'}
  // enforced at DB level (static_pages_status_chk).
  status: text('status').notNull().default('draft'),

  // When set + status='review', the publish-cron flips status='published'
  // at or after this time (Wave 15 D13).
  scheduled_publish_at: timestamp('scheduled_publish_at', { withTimezone: true, mode: 'string' }),

  // Backwards-compat boolean. Kept in sync with `status='published'` via the
  // sync trigger; do NOT write directly — write `status` and let the trigger
  // mirror it. Reads (`WHERE published=true`) keep working.
  published: boolean('published').notNull().default(false),
  published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),

  // Launch isolation parity with landing_pages.launch_lock (Wave 14 LP-INFRA).
  launch_lock: boolean('launch_lock').notNull().default(false),

  // Authorship audit. created_by_kind ∈ {'human','agent','system'}; CHECK at
  // DB level (static_pages_created_by_kind_chk).
  // - 'human'  → created_by_id resolves to profiles.id
  // - 'agent'  → created_by_id resolves to agent_tokens.id
  // - 'system' → created_by_id is NULL (migration / cron / seeder)
  // No FK because it is polymorphic across two tables.
  created_by_kind: text('created_by_kind').notNull(),
  created_by_id: uuid('created_by_id'),

  // Same polymorphic shape for the last-edit slot. CHECK on kind enforced.
  last_edited_by_kind: text('last_edited_by_kind').notNull(),
  last_edited_by_id: uuid('last_edited_by_id'),
  last_edited_by_name: text('last_edited_by_name'),
  last_edited_at: timestamp('last_edited_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),

  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
}, (t) => ({
  slugIdx: index('static_pages_slug_idx').on(t.slug),
  statusIdx: index('static_pages_status_idx').on(t.status),
  kindIdx: index('static_pages_kind_idx').on(t.kind),
  // published_at DESC NULLS LAST per migration 0065 — uses sql template for
  // expression mirroring (per learned-pattern 2026-04-24).
  publishedAtIdx: index('static_pages_published_at_idx').on(
    sql`${t.published_at} DESC NULLS LAST`,
  ),
  scheduledIdx: index('static_pages_scheduled_idx')
    .on(t.scheduled_publish_at)
    .where(sql`${t.scheduled_publish_at} IS NOT NULL`),
}));

export type StaticPage = typeof static_pages.$inferSelect;
export type NewStaticPage = typeof static_pages.$inferInsert;

/** Editorial kind whitelist — keep in sync with the DB CHECK constraint. */
export const STATIC_PAGE_KINDS = [
  'static',
  'program_detail',
  'methodology_essay',
  'portal_page',
] as const;
export type StaticPageKind = (typeof STATIC_PAGE_KINDS)[number];

/** Status state machine — keep in sync with the DB CHECK constraint. */
export const STATIC_PAGE_STATUSES = ['draft', 'review', 'published', 'archived'] as const;
export type StaticPageStatus = (typeof STATIC_PAGE_STATUSES)[number];

/** Authorship kind discriminator — keep in sync with the DB CHECK constraint. */
export const AUTHORSHIP_KINDS = ['human', 'agent', 'system'] as const;
export type AuthorshipKind = (typeof AUTHORSHIP_KINDS)[number];
