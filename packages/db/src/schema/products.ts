import { pgTable, boolean, integer, jsonb, numeric, text, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name_ar: text("name_ar").notNull(),
  name_en: text("name_en").notNull(),
  slug: text("slug").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  price_aed: integer("price_aed").default(0),
  price_egp: integer("price_egp").default(0),
  price_usd: integer("price_usd").default(0),
  images: jsonb("images"),
  stock: integer("stock").default(0),
  is_active: boolean("is_active").default(true),
  product_type: text("product_type").default('physical'),
  creator_id: uuid("creator_id").references(() => profiles.id),
  commission_override_pct: numeric("commission_override_pct"),
});

export type Products = typeof products.$inferSelect;
export type NewProducts = typeof products.$inferInsert;
