import { pgTable, boolean, index, integer, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';
import { enrollments } from './enrollments';
import { profiles } from './profiles';
import { quizzes } from './quizzes';

// answers_jsonb shape (one element per question answered):
// Array of:
//   { question_id: string, selected_option_ids?: string[], answer_text?: string, points_awarded?: number }
// Stored inline for simplicity — no separate quiz_answers table in this phase.
export const quiz_attempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  quiz_id: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  // nullable: admin/preview attempts may have no enrollment
  enrollment_id: uuid("enrollment_id").references(() => enrollments.id, { onDelete: 'set null' }),
  started_at: timestamp("started_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  // null = attempt still in progress
  submitted_at: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
  // null until submitted
  score_points: integer("score_points"),
  // snapshot of total possible points at submission time
  max_points: integer("max_points"),
  // computed percentage, null until submitted
  score_pct: integer("score_pct"),
  // null until submitted
  passed: boolean("passed"),
  // inline answers; see shape comment above
  answers_jsonb: jsonb("answers_jsonb"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  // "My attempts" query: fetch all attempts by user for a quiz, newest first
  userQuizStartedIdx: index("quiz_attempts_user_id_quiz_id_started_at_idx").on(
    t.user_id,
    t.quiz_id,
    t.started_at,
  ),
}));

export type QuizAttempts = typeof quiz_attempts.$inferSelect;
export type NewQuizAttempts = typeof quiz_attempts.$inferInsert;
