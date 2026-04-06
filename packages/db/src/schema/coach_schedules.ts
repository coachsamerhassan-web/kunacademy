import { pgTable, boolean, integer, text, time, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const coach_schedules = pgTable("coach_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  coach_id: uuid("coach_id").notNull().references(() => profiles.id),
  day_of_week: integer("day_of_week").notNull(),
  start_time: time("start_time").notNull(),
  end_time: time("end_time").notNull(),
  timezone: text("timezone").default('Asia/Dubai'),
  is_active: boolean("is_active").default(true),
  buffer_minutes: integer("buffer_minutes").default(15),
});

export type CoachSchedules = typeof coach_schedules.$inferSelect;
export type NewCoachSchedules = typeof coach_schedules.$inferInsert;
