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
  // Phase 1a: CMS→DB extension columns
  role_ar: text("role_ar"),
  role_en: text("role_en"),
  location_ar: text("location_ar"),
  location_en: text("location_en"),
  // ISO-3166 2-letter country code, e.g. "EG", "SA" — validated by DB CHECK constraint
  country_code: text("country_code"),
  display_order: integer("display_order").notNull().default(0),
  // Phase 1b: preserves CMS slug-style id ("nizar", "scott-mcconnell") for migration idempotency + external link continuity. Admin-created testimonials leave this null.
  legacy_slug: text("legacy_slug"),
});

export type Testimonials = typeof testimonials.$inferSelect;
export type NewTestimonials = typeof testimonials.$inferInsert;
