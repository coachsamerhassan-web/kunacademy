import { pgTable, date, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const coach_time_off = pgTable("coach_time_off", {
  id: uuid("id").primaryKey().defaultRandom(),
  coach_id: uuid("coach_id").notNull().references(() => profiles.id),
  start_date: date("start_date").notNull(),
  end_date: date("end_date").notNull(),
  reason: text("reason"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CoachTimeOff = typeof coach_time_off.$inferSelect;
export type NewCoachTimeOff = typeof coach_time_off.$inferInsert;
