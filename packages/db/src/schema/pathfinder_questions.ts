import {
  pgTable,
  boolean,
  integer,
  text,
  timestamp,
  uuid,
  unique,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';
import { pathfinder_tree_versions } from './pathfinder_tree_versions';

/**
 * pathfinder_questions.type = 'individual' | 'corporate' (pg enum pathfinder_question_type).
 * parent_answer_id self-references pathfinder_answers(id); nullable for root questions.
 * FK declared at SQL-level (circular ref) — Drizzle typing uses plain uuid here.
 */
export const pathfinder_questions = pgTable(
  'pathfinder_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version_id: uuid('version_id')
      .notNull()
      .references(() => pathfinder_tree_versions.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    question_ar: text('question_ar').notNull(),
    question_en: text('question_en'),
    type: text('type').notNull().default('individual'),
    parent_answer_id: uuid('parent_answer_id'),
    sort_order: integer('sort_order').notNull().default(0),
    is_terminal_gate: boolean('is_terminal_gate').notNull().default(false),
    published: boolean('published').notNull().default(true),
    last_edited_by: uuid('last_edited_by').references(() => profiles.id, { onDelete: 'set null' }),
    last_edited_at: timestamp('last_edited_at', { withTimezone: true, mode: 'string' }),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    versionCodeUnique: unique('pathfinder_questions_version_code_unique').on(t.version_id, t.code),
  }),
);

export type PathfinderQuestionRow = typeof pathfinder_questions.$inferSelect;
export type NewPathfinderQuestionRow = typeof pathfinder_questions.$inferInsert;
