import { pgTable, boolean, integer, timestamp, uuid } from 'drizzle-orm/pg-core';
import { lessons } from './lessons';
import { lesson_placements } from './lesson_placements';
import { profiles } from './profiles';

/**
 * lesson_progress — per-student playback + completion state.
 *
 * Post-0047 (Session B): `placement_id` added as the preferred anchor so
 * progress in Course A vs Course B for the same reusable lesson tracks
 * independently. Legacy `lesson_id` column retained (nullable not yet, see
 * below) until Session C finalizes the student lesson player migration.
 *
 * Writers (app layer):
 *   - New code: SET placement_id from route context; lesson_id keeps legacy write.
 *   - Student UI (Session C): set placement_id ONLY; drop lesson_id usage.
 */
export const lesson_progress = pgTable("lesson_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  // DEPRECATED (Session C will drop). Session B writes fill it alongside placement_id.
  lesson_id: uuid("lesson_id").notNull().references(() => lessons.id),
  placement_id: uuid("placement_id").references(() => lesson_placements.id, { onDelete: 'cascade' }),
  playback_position_seconds: integer("playback_position_seconds").default(0),
  completed: boolean("completed").default(false),
  completed_at: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type LessonProgress = typeof lesson_progress.$inferSelect;
export type NewLessonProgress = typeof lesson_progress.$inferInsert;
