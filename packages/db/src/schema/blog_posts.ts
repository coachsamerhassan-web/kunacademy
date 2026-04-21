import { pgTable, boolean, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
});

export type BlogPosts = typeof blog_posts.$inferSelect;
export type NewBlogPosts = typeof blog_posts.$inferInsert;
