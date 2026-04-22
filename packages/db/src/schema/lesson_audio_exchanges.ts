import { pgTable, boolean, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * lesson_audio_exchanges — the "audio prompt + student response" primitive.
 *
 * Per D4a=iii (Samer 2026-04-22), defaults to REFLECTION mode (requires_review
 * = false). Coach flags `requires_review = true` to promote it into a
 * quiz-like assessed exchange. Student responses land in `lesson_audio_responses`
 * and are scoped by lesson_placements.id (NOT by exchange alone) so the same
 * exchange placed in Course A vs Course B collects independent response sets.
 *
 * Ownership (D4e=i + =iii): `created_by` is the sole updater; other coaches
 * may clone-to-fork (INSERT as themselves) via app logic.
 */
export const lesson_audio_exchanges = pgTable("lesson_audio_exchanges", {
  id:                      uuid("id").primaryKey().defaultRandom(),
  prompt_audio_url:        text("prompt_audio_url").notNull(),
  prompt_duration_sec:     integer("prompt_duration_sec"),
  prompt_transcript_ar:    text("prompt_transcript_ar"),
  prompt_transcript_en:    text("prompt_transcript_en"),
  instructions_ar:         text("instructions_ar"),
  instructions_en:         text("instructions_en"),
  response_mode:           text("response_mode").notNull().default('either'),   // 'audio_only' | 'text_only' | 'either'
  response_time_limit_sec: integer("response_time_limit_sec"),
  requires_review:         boolean("requires_review").notNull().default(false),  // D4a=iii
  created_by:              uuid("created_by").references(() => profiles.id),
  created_at:              timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at:              timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export type LessonAudioExchange = typeof lesson_audio_exchanges.$inferSelect;
export type NewLessonAudioExchange = typeof lesson_audio_exchanges.$inferInsert;
