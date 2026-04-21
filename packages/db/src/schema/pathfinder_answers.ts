import {
  pgTable,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
  unique,
} from 'drizzle-orm/pg-core';
import { pathfinder_questions } from './pathfinder_questions';

export const pathfinder_answers = pgTable(
  'pathfinder_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question_id: uuid('question_id')
      .notNull()
      .references(() => pathfinder_questions.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    text_ar: text('text_ar').notNull(),
    text_en: text('text_en'),
    category_weights: jsonb('category_weights').notNull().default({}),
    recommended_slugs: text('recommended_slugs').array().notNull().default([]),
    sort_order: integer('sort_order').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    questionCodeUnique: unique('pathfinder_answers_question_code_unique').on(t.question_id, t.code),
  }),
);

export type PathfinderAnswerRow = typeof pathfinder_answers.$inferSelect;
export type NewPathfinderAnswerRow = typeof pathfinder_answers.$inferInsert;
