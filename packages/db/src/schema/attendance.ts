import { pgTable, date, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { enrollments } from './enrollments';
import { profiles } from './profiles';

export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollment_id: uuid("enrollment_id").notNull().references(() => enrollments.id),
  session_date: date("session_date").notNull(),
  session_number: integer("session_number"),
  status: text("status").notNull(),
  notes: text("notes"),
  marked_by: uuid("marked_by").references(() => profiles.id),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;
