import { pgTable, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from './products';

export const digital_assets = pgTable("digital_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  product_id: uuid("product_id").notNull().references(() => products.id),
  file_url: text("file_url").notNull(),
  file_type: text("file_type").notNull(),
  file_size_bytes: integer("file_size_bytes"),
  display_name: text("display_name"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type DigitalAssets = typeof digital_assets.$inferSelect;
export type NewDigitalAssets = typeof digital_assets.$inferInsert;
