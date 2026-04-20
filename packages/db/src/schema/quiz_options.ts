import { pgTable, boolean, index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { quiz_questions } from './quiz_questions';

// Options apply to single / multi / true_false question types.
// short_answer questions have no options — enforced at API layer.
// SECURITY NOTE: is_correct MUST be stripped in API responses to students.
// Expose is_correct only in admin/instructor endpoints and post-submission result payloads.
export const quiz_options = pgTable("quiz_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  question_id: uuid("question_id").notNull().references(() => quiz_questions.id, { onDelete: 'cascade' }),
  option_ar: text("option_ar").notNull(),
  option_en: text("option_en").notNull(),
  is_correct: boolean("is_correct").notNull().default(false),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  // Ordered fetches per question
  questionSortIdx: index("quiz_options_question_id_sort_order_idx").on(t.question_id, t.sort_order),
}));

export type QuizOptions = typeof quiz_options.$inferSelect;
export type NewQuizOptions = typeof quiz_options.$inferInsert;
