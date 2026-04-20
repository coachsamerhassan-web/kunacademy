import { pgTable, boolean, date, integer, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  // human-readable stable id (e.g. "samer-2023-01")
  quote_id: text("quote_id").notNull().unique(),
  author_ar: text("author_ar").notNull(),
  author_en: text("author_en").notNull(),
  content_ar: text("content_ar").notNull(),
  content_en: text("content_en").notNull(),
  // e.g. "coaching", "somatic-thinking", "faith"
  category: text("category"),
  display_order: integer("display_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
  // when the quote was spoken/written
  quote_date: date("quote_date"),
  last_edited_by: uuid("last_edited_by").references(() => profiles.id),
  last_edited_at: timestamp("last_edited_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  publishedDisplayOrderIdx: index("quotes_published_display_order_idx").on(t.published, t.display_order),
  categoryIdx: index("quotes_category_idx").on(t.category),
}));

export type Quotes = typeof quotes.$inferSelect;
export type NewQuotes = typeof quotes.$inferInsert;
