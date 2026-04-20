import { pgTable, boolean, integer, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { lessons } from './lessons';

export const quizzes = pgTable("quizzes", {
  id: uuid("id").primaryKey().defaultRandom(),
  // One quiz per lesson at most; lesson may have no quiz (nullable FK)
  lesson_id: uuid("lesson_id").references(() => lessons.id, { onDelete: 'cascade' }),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  // Percentage (0-100) required to pass
  pass_threshold: integer("pass_threshold").notNull().default(70),
  // null = unlimited attempts
  attempts_allowed: integer("attempts_allowed"),
  // null = no time limit
  time_limit_seconds: integer("time_limit_seconds"),
  shuffle_questions: boolean("shuffle_questions").notNull().default(false),
  is_published: boolean("is_published").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  // Enforce one quiz per lesson at the DB level
  lessonUnique: uniqueIndex("quizzes_lesson_id_key").on(t.lesson_id),
}));

export type Quizzes = typeof quizzes.$inferSelect;
export type NewQuizzes = typeof quizzes.$inferInsert;
