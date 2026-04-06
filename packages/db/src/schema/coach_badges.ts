import { pgTable, integer, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const coach_badges = pgTable("coach_badges", {
  coach_id: uuid("coach_id").notNull().references(() => profiles.id),
  badge_tier: text("badge_tier").notNull(),
  avg_rating: numeric("avg_rating").default("0").notNull(),
  review_count: integer("review_count").default(0).notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CoachBadges = typeof coach_badges.$inferSelect;
export type NewCoachBadges = typeof coach_badges.$inferInsert;
