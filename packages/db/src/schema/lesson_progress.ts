import { pgTable, boolean, integer, timestamp, uuid } from 'drizzle-orm/pg-core';
import { lessons } from './lessons';
import { profiles } from './profiles';

export const lesson_progress = pgTable("lesson_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  lesson_id: uuid("lesson_id").notNull().references(() => lessons.id),
  playback_position_seconds: integer("playback_position_seconds").default(0),
  completed: boolean("completed").default(false),
  completed_at: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type LessonProgress = typeof lesson_progress.$inferSelect;
export type NewLessonProgress = typeof lesson_progress.$inferInsert;
