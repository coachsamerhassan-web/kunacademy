import { pgTable, boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { courses } from './courses';

export const community_boards = pgTable("community_boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name_ar: text("name_ar").notNull(),
  name_en: text("name_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  type: text("type").notNull(),
  is_admin_only: boolean("is_admin_only").default(false),
  course_id: uuid("course_id").references(() => courses.id),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CommunityBoards = typeof community_boards.$inferSelect;
export type NewCommunityBoards = typeof community_boards.$inferInsert;
