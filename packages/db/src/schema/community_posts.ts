import { pgTable, boolean, text, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { community_boards } from './community_boards';
import { profiles } from './profiles';

export const community_posts = pgTable("community_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  board_id: uuid("board_id").notNull().references(() => community_boards.id),
  author_id: uuid("author_id").notNull().references(() => profiles.id),
  parent_id: uuid("parent_id").references((): AnyPgColumn => community_posts.id),
  content: text("content").notNull(),
  is_pinned: boolean("is_pinned").default(false),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CommunityPosts = typeof community_posts.$inferSelect;
export type NewCommunityPosts = typeof community_posts.$inferInsert;
