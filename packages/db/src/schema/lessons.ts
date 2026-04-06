import { pgTable, boolean, integer, text, uuid } from 'drizzle-orm/pg-core';
import { course_sections } from './course_sections';
import { courses } from './courses';

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  course_id: uuid("course_id").notNull().references(() => courses.id),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en").notNull(),
  content_ar: text("content_ar"),
  content_en: text("content_en"),
  video_url: text("video_url"),
  order: integer("order").notNull(),
  duration_minutes: integer("duration_minutes"),
  section_id: uuid("section_id").references(() => course_sections.id),
  is_preview: boolean("is_preview").default(false),
  video_provider: text("video_provider"),
  video_id: text("video_id"),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
});

export type Lessons = typeof lessons.$inferSelect;
export type NewLessons = typeof lessons.$inferInsert;
