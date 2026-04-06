import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { community_boards } from './community_boards';
import { profiles } from './profiles';

export const board_members = pgTable("board_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  board_id: uuid("board_id").notNull().references(() => community_boards.id),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  role: text("role").default('member'),
  joined_at: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type BoardMembers = typeof board_members.$inferSelect;
export type NewBoardMembers = typeof board_members.$inferInsert;
