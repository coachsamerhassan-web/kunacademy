import { pgTable, boolean, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';
import { profiles } from './profiles';
import { testimonials } from './testimonials';

export const coach_ratings = pgTable("coach_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  coach_id: uuid("coach_id").notNull().references(() => profiles.id),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  rating: integer("rating").notNull(),
  review_text: text("review_text"),
  testimonial_id: uuid("testimonial_id").references(() => testimonials.id),
  booking_id: uuid("booking_id").references(() => bookings.id),
  is_published: boolean("is_published").default(false),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CoachRatings = typeof coach_ratings.$inferSelect;
export type NewCoachRatings = typeof coach_ratings.$inferInsert;
