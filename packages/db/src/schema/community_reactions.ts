import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { community_posts } from './community_posts';
import { profiles } from './profiles';

export const community_reactions = pgTable("community_reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  post_id: uuid("post_id").notNull().references(() => community_posts.id),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  reaction: text("reaction").notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CommunityReactions = typeof community_reactions.$inferSelect;
export type NewCommunityReactions = typeof community_reactions.$inferInsert;
