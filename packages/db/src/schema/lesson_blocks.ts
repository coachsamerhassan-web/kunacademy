import { pgTable, integer, text, timestamp, uuid, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { lessons } from './lessons';
import { quizzes } from './quizzes';
import { lesson_audio_exchanges } from './lesson_audio_exchanges';

/**
 * lesson_blocks — polymorphic ordered content within a lesson.
 *
 * block_type ∈ { 'video','text','pdf','image','audio','callout','quiz_ref','audio_exchange' }
 *
 * block_data JSONB shape varies by block_type. Suggested shapes (not enforced at DB):
 *   video:     { provider: 'bunny'|'youtube'|'vimeo'|'direct', video_id, url, duration_sec, thumbnail_url }
 *   text:      { content_ar, content_en, format: 'markdown'|'html' }
 *   pdf:       { url, filename, pages }
 *   image:     { url, alt_ar, alt_en, caption_ar, caption_en }
 *   audio:     { url, duration_sec, transcript_ar, transcript_en }
 *   callout:   { variant: 'info'|'warn'|'tip', title_ar, title_en, body_ar, body_en }
 *   quiz_ref:  {}  -- quiz fully addressed by quiz_id FK
 *   audio_exchange: {}  -- fully addressed by audio_exchange_id FK
 *
 * CHECK constraint enforces that quiz_id is present iff block_type='quiz_ref'
 * and audio_exchange_id is present iff block_type='audio_exchange'.
 */
export const lesson_blocks = pgTable("lesson_blocks", {
  id:                uuid("id").primaryKey().defaultRandom(),
  lesson_id:         uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  sort_order:        integer("sort_order").notNull(),
  block_type:        text("block_type").notNull(),
  block_data:        jsonb("block_data").notNull().default({}),
  quiz_id:           uuid("quiz_id").references(() => quizzes.id, { onDelete: 'set null' }),
  audio_exchange_id: uuid("audio_exchange_id").references(() => lesson_audio_exchanges.id, { onDelete: 'set null' }),
  created_at:        timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  lessonSortUnique: unique("lesson_blocks_lesson_sort_unique").on(t.lesson_id, t.sort_order),
  lessonIdx: index("idx_lesson_blocks_lesson").on(t.lesson_id, t.sort_order),
}));

export type LessonBlock = typeof lesson_blocks.$inferSelect;
export type NewLessonBlock = typeof lesson_blocks.$inferInsert;

export type LessonBlockType =
  | 'video'
  | 'text'
  | 'pdf'
  | 'image'
  | 'audio'
  | 'callout'
  | 'quiz_ref'
  | 'audio_exchange';
