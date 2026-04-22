import { pgTable, integer, text, timestamp, uuid, index, unique } from 'drizzle-orm/pg-core';
import { courses } from './courses';
import { course_sections } from './course_sections';
import { lessons } from './lessons';

/**
 * lesson_placements — the many-to-many bridge that lets a single reusable
 * `lesson` appear in multiple courses. Per-course ordering, per-course title
 * override, and all student-interaction FKs (audio responses, in Session B+)
 * anchor on this row — NOT on the lesson — so responses in Course A never
 * aggregate with Course B.
 *
 * `lesson_id` uses ON DELETE RESTRICT (D4f=i): cannot delete a lesson that
 * is placed in any course. Caller gets a 23503 FK violation; admin UI
 * surfaces "used in N courses, remove first."
 */
export const lesson_placements = pgTable("lesson_placements", {
  id:                uuid("id").primaryKey().defaultRandom(),
  course_id:         uuid("course_id").notNull().references(() => courses.id, { onDelete: 'cascade' }),
  section_id:        uuid("section_id").references(() => course_sections.id, { onDelete: 'set null' }),
  lesson_id:         uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: 'restrict' }),
  sort_order:        integer("sort_order").notNull(),
  override_title_ar: text("override_title_ar"),
  override_title_en: text("override_title_en"),
  created_at:        timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  sectionSortUnique:       unique("lesson_placements_section_sort_unique").on(t.section_id, t.sort_order),
  courseLessonSectionUnique: unique("lesson_placements_course_lesson_section_unique").on(t.course_id, t.lesson_id, t.section_id),
  courseIdx: index("idx_lesson_placements_course").on(t.course_id, t.sort_order),
  lessonIdx: index("idx_lesson_placements_lesson").on(t.lesson_id),
}));

export type LessonPlacement = typeof lesson_placements.$inferSelect;
export type NewLessonPlacement = typeof lesson_placements.$inferInsert;
