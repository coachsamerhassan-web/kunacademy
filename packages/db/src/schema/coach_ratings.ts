import { pgTable, boolean, integer, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';
import { profiles } from './profiles';
import { testimonials } from './testimonials';

export const coach_ratings = pgTable("coach_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  coach_id: uuid("coach_id").notNull().references(() => profiles.id),
  // user_id = the client who submitted the rating
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  rating: integer("rating").notNull(),
  review_text: text("review_text"),
  testimonial_id: uuid("testimonial_id").references(() => testimonials.id),
  // booking_id links rating to the specific session (UNIQUE — one rating per booking)
  booking_id: uuid("booking_id").references(() => bookings.id, { onDelete: 'set null' }),
  is_published: boolean("is_published").default(false),
  // privacy: 'public' (default, can be promoted to testimonial) | 'private'
  privacy: text("privacy").default('public'),
  // rated_at: explicit timestamp when client submitted (separate from created_at)
  rated_at: timestamp("rated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => ({
  // One rating per booking — enforced at DB + Drizzle level
  bookingUnique: uniqueIndex("coach_ratings_booking_id_key").on(t.booking_id),
}));

export type CoachRatings = typeof coach_ratings.$inferSelect;
export type NewCoachRatings = typeof coach_ratings.$inferInsert;
