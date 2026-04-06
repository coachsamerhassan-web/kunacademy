import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const book_access = pgTable("book_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  book_slug: text("book_slug").notNull(),
  granted_at: timestamp("granted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  granted_by: text("granted_by").default('purchase'),
});

export type BookAccess = typeof book_access.$inferSelect;
export type NewBookAccess = typeof book_access.$inferInsert;
