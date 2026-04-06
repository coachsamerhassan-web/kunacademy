import { pgTable, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { courses } from './courses';

export const course_sections = pgTable("course_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  course_id: uuid("course_id").notNull().references(() => courses.id),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  order: integer("order").default(0).notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CourseSections = typeof course_sections.$inferSelect;
export type NewCourseSections = typeof course_sections.$inferInsert;
