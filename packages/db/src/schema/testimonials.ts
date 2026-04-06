import { pgTable, boolean, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { instructors } from './instructors';

export const testimonials = pgTable("testimonials", {
  id: uuid("id").primaryKey().defaultRandom(),
  author_name_ar: text("author_name_ar"),
  author_name_en: text("author_name_en"),
  content_ar: text("content_ar").notNull(),
  content_en: text("content_en"),
  coach_id: uuid("coach_id").references(() => instructors.id),
  program: text("program"),
  rating: integer("rating"),
  video_url: text("video_url"),
  is_featured: boolean("is_featured").default(false),
  source_type: text("source_type"),
  migrated_at: timestamp("migrated_at", { withTimezone: true, mode: 'string' }),
});

export type Testimonials = typeof testimonials.$inferSelect;
export type NewTestimonials = typeof testimonials.$inferInsert;
