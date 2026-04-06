import { pgTable, integer, timestamp, uuid } from 'drizzle-orm/pg-core';
import { digital_assets } from './digital_assets';
import { order_items } from './order_items';
import { profiles } from './profiles';

export const download_tokens = pgTable("download_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  order_item_id: uuid("order_item_id").notNull().references(() => order_items.id),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  asset_id: uuid("asset_id").notNull().references(() => digital_assets.id),
  token: uuid("token").defaultRandom(),
  expires_at: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
  download_count: integer("download_count").default(0),
  max_downloads: integer("max_downloads").default(3),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type DownloadTokens = typeof download_tokens.$inferSelect;
export type NewDownloadTokens = typeof download_tokens.$inferInsert;
