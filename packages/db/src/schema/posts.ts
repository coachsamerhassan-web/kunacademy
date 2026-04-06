import { pgTable, boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en").notNull(),
  slug: text("slug").notNull(),
  content_ar: text("content_ar"),
  content_en: text("content_en"),
  excerpt_ar: text("excerpt_ar"),
  excerpt_en: text("excerpt_en"),
  category: text("category"),
  featured_image: text("featured_image"),
  author_id: uuid("author_id").references(() => profiles.id),
  is_published: boolean("is_published").default(false),
  published_at: timestamp("published_at", { withTimezone: true, mode: 'string' }),
});

export type Posts = typeof posts.$inferSelect;
export type NewPosts = typeof posts.$inferInsert;
