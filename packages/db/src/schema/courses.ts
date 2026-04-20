import { pgTable, boolean, integer, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { instructors } from './instructors';

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en").notNull(),
  slug: text("slug").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  instructor_id: uuid("instructor_id").references(() => instructors.id),
  coach_ids: text("coach_ids").array(),
  price_aed: integer("price_aed").default(0),
  price_egp: integer("price_egp").default(0),
  price_usd: integer("price_usd").default(0),
  price_eur: integer("price_eur").default(0),
  duration_hours: numeric("duration_hours"),
  level: text("level"),
  nav_group: text("nav_group"),
  internal_category: text("internal_category"),
  type: text("type"),
  format: text("format"),
  location: text("location"),
  is_featured: boolean("is_featured").default(false),
  is_free: boolean("is_free").default(false),
  is_icf_accredited: boolean("is_icf_accredited").default(false),
  icf_details: text("icf_details"),
  thumbnail_url: text("thumbnail_url"),
  is_published: boolean("is_published").default(false),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  price_sar: integer("price_sar").default(0),
  total_lessons: integer("total_lessons").default(0),
  total_video_minutes: integer("total_video_minutes").default(0),
  min_completion_pct: integer("min_completion_pct").notNull().default(100),
  require_quiz_pass: boolean("require_quiz_pass").notNull().default(true),
});

export type Courses = typeof courses.$inferSelect;
export type NewCourses = typeof courses.$inferInsert;
