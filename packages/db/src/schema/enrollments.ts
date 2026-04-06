import { pgTable, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { courses } from './courses';
import { profiles } from './profiles';

export const enrollments = pgTable("enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  course_id: uuid("course_id").notNull().references(() => courses.id),
  progress_data: jsonb("progress_data"),
  completed_at: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
  enrolled_at: timestamp("enrolled_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  status: text("status").default('enrolled'),
  enrollment_type: text("enrollment_type").default('recorded'),
  expires_at: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
});

export type Enrollments = typeof enrollments.$inferSelect;
export type NewEnrollments = typeof enrollments.$inferInsert;
