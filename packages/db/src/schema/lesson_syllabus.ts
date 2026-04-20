import { pgTable, boolean, integer, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { lessons } from './lessons';

export const lesson_syllabus = pgTable("lesson_syllabus", {
  id: uuid("id").primaryKey(),
  course_id: uuid("course_id"),
  section_id: uuid("section_id"),
  lesson_id: uuid("lesson_id").references(() => lessons.id, { onDelete: 'cascade' }),
  title_ar: text("title_ar"),
  title_en: text("title_en"),
  order: integer("order"),
  duration_minutes: integer("duration_minutes"),
  is_preview: boolean("is_preview"),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type LessonSyllabus = typeof lesson_syllabus.$inferSelect;
export type NewLessonSyllabus = typeof lesson_syllabus.$inferInsert;
