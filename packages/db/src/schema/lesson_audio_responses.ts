import { pgTable, integer, text, timestamp, uuid, index, unique } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';
import { lesson_placements } from './lesson_placements';
import { lesson_audio_exchanges } from './lesson_audio_exchanges';

/**
 * lesson_audio_responses — one student's submission for one audio-exchange
 * in one course placement.
 *
 * Scoping: UNIQUE (exchange_id, placement_id, student_id). Responses are
 * course-placement-scoped, so the same student answering the same underlying
 * exchange in a different course produces a DIFFERENT row. Aggregates,
 * progress, and coach review are computed per-placement.
 *
 * review_status is NULL unless the parent exchange.requires_review = true
 * (D4a=iii). coach_comment is the default D4b=ii feedback surface (structured
 * rubric deferred to Session C).
 */
export const lesson_audio_responses = pgTable("lesson_audio_responses", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  exchange_id:        uuid("exchange_id").notNull().references(() => lesson_audio_exchanges.id, { onDelete: 'cascade' }),
  placement_id:       uuid("placement_id").notNull().references(() => lesson_placements.id, { onDelete: 'cascade' }),
  student_id:         uuid("student_id").notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  audio_url:          text("audio_url"),
  audio_duration_sec: integer("audio_duration_sec"),
  text_response:      text("text_response"),
  coach_comment:      text("coach_comment"),
  coach_commented_at: timestamp("coach_commented_at", { withTimezone: true, mode: 'string' }),
  coach_commented_by: uuid("coach_commented_by").references(() => profiles.id),
  review_status:      text("review_status"),   // null | 'pending' | 'reviewed' | 'approved' | 'needs_rework'
  submitted_at:       timestamp("submitted_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique("lesson_audio_responses_unique").on(t.exchange_id, t.placement_id, t.student_id),
  exchangeIdx: index("idx_lesson_audio_responses_exchange").on(t.exchange_id, t.placement_id),
  studentIdx:  index("idx_lesson_audio_responses_student").on(t.student_id, t.submitted_at),
}));

export type LessonAudioResponse = typeof lesson_audio_responses.$inferSelect;
export type NewLessonAudioResponse = typeof lesson_audio_responses.$inferInsert;
