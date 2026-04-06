import { pgTable, boolean, integer, text, uuid } from 'drizzle-orm/pg-core';

export const lesson_syllabus = pgTable("lesson_syllabus", {
  id: uuid("id").primaryKey(),
  course_id: uuid("course_id"),
  section_id: uuid("section_id"),
  title_ar: text("title_ar"),
  title_en: text("title_en"),
  order: integer("order"),
  duration_minutes: integer("duration_minutes"),
  is_preview: boolean("is_preview"),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
});

export type LessonSyllabus = typeof lesson_syllabus.$inferSelect;
export type NewLessonSyllabus = typeof lesson_syllabus.$inferInsert;
