import { pgTable, boolean, integer, numeric, text, uuid } from 'drizzle-orm/pg-core';
import { service_categories } from './service_categories';

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name_ar: text("name_ar").notNull(),
  name_en: text("name_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  duration_minutes: integer("duration_minutes").notNull(),
  price_aed: integer("price_aed").default(0),
  price_egp: integer("price_egp").default(0),
  price_usd: integer("price_usd").default(0),
  is_active: boolean("is_active").default(true),
  price_sar: integer("price_sar").default(0),
  commission_override_pct: numeric("commission_override_pct"),
  category_id: uuid("category_id").references(() => service_categories.id),
  sessions_count: integer("sessions_count"),
  validity_days: integer("validity_days"),
});

export type Services = typeof services.$inferSelect;
export type NewServices = typeof services.$inferInsert;
