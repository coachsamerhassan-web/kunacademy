import { pgTable, boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const blog_posts = pgTable("blog_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en"),
  body_ar: text("body_ar"),
  body_en: text("body_en"),
  excerpt_ar: text("excerpt_ar"),
  excerpt_en: text("excerpt_en"),
  author_id: uuid("author_id").references(() => profiles.id),
  category: text("category"),
  tags: text("tags").array(),
  featured_image: text("featured_image"),
  content_doc_id: text("content_doc_id"),
  is_published: boolean("is_published").default(false),
  published_at: timestamp("published_at", { withTimezone: true, mode: 'string' }),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type BlogPosts = typeof blog_posts.$inferSelect;
export type NewBlogPosts = typeof blog_posts.$inferInsert;
