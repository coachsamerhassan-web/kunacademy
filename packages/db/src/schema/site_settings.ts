import { pgTable, boolean, text, timestamp, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const site_settings = pgTable("site_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  // e.g. "social", "contact", "footer", "branding", "seo"
  category: text("category").notNull(),
  // e.g. "instagram_url", "phone_primary"
  key: text("key").notNull(),
  // stringified value (JSON-encoded if structured)
  value: text("value").notNull(),
  // optional admin-facing hint
  description: text("description"),
  published: boolean("published").notNull().default(true),
  last_edited_by: uuid("last_edited_by").references(() => profiles.id),
  last_edited_at: timestamp("last_edited_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  categoryKeyUnique: uniqueIndex("site_settings_category_key_key").on(t.category, t.key),
  publishedIdx: index("site_settings_published_idx").on(t.published),
}));

export type SiteSettings = typeof site_settings.$inferSelect;
export type NewSiteSettings = typeof site_settings.$inferInsert;
