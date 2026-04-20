import { pgTable, index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { quizzes } from './quizzes';

// CHECK constraint on type is defined in the SQL migration (0026_quiz_engine_foundation.sql).
// Drizzle 0.45.x check() requires importing the `check` + `sql` helpers; skipped here to
// avoid adding a raw-sql import to the schema layer — constraint is enforced at DB level.
export const quiz_questions = pgTable("quiz_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  quiz_id: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  // Allowed values: 'single' | 'multi' | 'true_false' | 'short_answer'
  // Enforced by CHECK constraint in migration 0026.
  type: text("type").notNull(),
  prompt_ar: text("prompt_ar").notNull(),
  prompt_en: text("prompt_en").notNull(),
  // Optional explanation shown to student after submission
  explanation_ar: text("explanation_ar"),
  explanation_en: text("explanation_en"),
  points: integer("points").notNull().default(1),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  // Ordered fetches: SELECT ... WHERE quiz_id = ? ORDER BY sort_order
  quizSortIdx: index("quiz_questions_quiz_id_sort_order_idx").on(t.quiz_id, t.sort_order),
}));

export type QuizQuestions = typeof quiz_questions.$inferSelect;
export type NewQuizQuestions = typeof quiz_questions.$inferInsert;
