import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { instructors } from './instructors';
import { profiles } from './profiles';

export const instructor_drafts = pgTable("instructor_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  instructor_id: uuid("instructor_id").notNull().references(() => instructors.id),
  field_name: text("field_name").notNull(),
  old_value: text("old_value"),
  new_value: text("new_value"),
  status: text("status").default('pending'),
  submitted_at: timestamp("submitted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  reviewed_at: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
  reviewer_id: uuid("reviewer_id").references(() => profiles.id),
  review_note: text("review_note"),
});

export type InstructorDrafts = typeof instructor_drafts.$inferSelect;
export type NewInstructorDrafts = typeof instructor_drafts.$inferInsert;
