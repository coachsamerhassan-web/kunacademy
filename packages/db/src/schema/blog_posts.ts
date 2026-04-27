import { pgTable, boolean, integer, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './profiles';

export const blog_posts = pgTable('blog_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  title_ar: text('title_ar').notNull(),
  title_en: text('title_en'),
  content_ar: text('content_ar'),
  content_en: text('content_en'),
  excerpt_ar: text('excerpt_ar'),
  excerpt_en: text('excerpt_en'),
  meta_title_ar: text('meta_title_ar'),
  meta_title_en: text('meta_title_en'),
  meta_description_ar: text('meta_description_ar'),
  meta_description_en: text('meta_description_en'),
  author_id: uuid('author_id').references(() => profiles.id),
  author_slug: text('author_slug'),
  category: text('category'),
  tags: text('tags').array(),
  featured_image_url: text('featured_image_url'),
  content_doc_id: text('content_doc_id'),
  reading_time_minutes: integer('reading_time_minutes'),
  is_featured: boolean('is_featured').notNull().default(false),
  display_order: integer('display_order').notNull().default(0),
  published: boolean('published').default(false),
  published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),
  last_edited_by: uuid('last_edited_by').references(() => profiles.id),
  last_edited_at: timestamp('last_edited_at', { withTimezone: true, mode: 'string' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  // ── Wave 15 Wave 1 (migration 0066) ──────────────────────────────────
  // Status state machine. CHECK in {'draft','review','published','archived'}
  // at DB level. `published` boolean is mirrored via the sync trigger; write
  // status, not published.
  status: text('status').notNull().default('draft'),
  // When set + status='review', the publish-cron flips status='published'
  // at or after this time (Wave 15 D13).
  scheduled_publish_at: timestamp('scheduled_publish_at', { withTimezone: true, mode: 'string' }),
  // Authorship discriminator for last_edited_by. CHECK in
  // {'human','agent','system'} at DB level.
  last_edited_by_kind: text('last_edited_by_kind').notNull().default('human'),
  last_edited_by_name: text('last_edited_by_name'),
  // Editorial kind: 'blog_article' (default) | 'announcement_post'.
  // CHECK at DB level.
  kind: text('kind').notNull().default('blog_article'),
  // Optional sectioned long-form composition (Wave 16 promotion to rich
  // authoring). NULL = falls back to scalar content_ar/en + *_rich.
  composition_json: jsonb('composition_json'),
  // TipTap JSON companions to scalar content_ar / content_en. Authored via
  // BilingualRichEditor; rendered via RichContent component. Maintained in
  // lockstep via markdown-adapter round-trip (Wave 15 P2 pattern).
  content_ar_rich: jsonb('content_ar_rich'),
  content_en_rich: jsonb('content_en_rich'),
  excerpt_ar_rich: jsonb('excerpt_ar_rich'),
  excerpt_en_rich: jsonb('excerpt_en_rich'),
}, (t) => ({
  // ── Wave 15 Wave 1 indexes ──────────────────────────────────────────
  statusIdx: index('blog_posts_status_idx').on(t.status),
  scheduledIdx: index('blog_posts_scheduled_idx')
    .on(t.scheduled_publish_at)
    .where(sql`${t.scheduled_publish_at} IS NOT NULL`),
  kindIdx: index('blog_posts_kind_idx').on(t.kind),
}));

export type BlogPosts = typeof blog_posts.$inferSelect;
export type NewBlogPosts = typeof blog_posts.$inferInsert;
