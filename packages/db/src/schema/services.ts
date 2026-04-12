import { pgTable, boolean, integer, numeric, text, uuid } from 'drizzle-orm/pg-core';
import { service_categories } from './service_categories';

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Stable URL-safe identifier (e.g. 'discovery', 'individual-basic', '3-session-package') */
  slug: text("slug"),
  name_ar: text("name_ar").notNull(),
  name_en: text("name_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  duration_minutes: integer("duration_minutes").notNull(),
  /** Prices in minor units (250 AED stored as 25000) */
  price_aed: integer("price_aed").default(0),
  price_egp: integer("price_egp").default(0),
  price_usd: integer("price_usd").default(0),
  is_active: boolean("is_active").default(true),
  price_sar: integer("price_sar").default(0),
  commission_override_pct: numeric("commission_override_pct"),
  category_id: uuid("category_id").references(() => service_categories.id),
  sessions_count: integer("sessions_count"),
  validity_days: integer("validity_days"),
  /**
   * Kun coach levels that can deliver this service.
   * NULL = all levels. Values: basic | professional | expert | master
   */
  eligible_kun_levels: text("eligible_kun_levels").array(),
  coach_control: text('coach_control').notNull().default('mandatory'),
  allows_coach_pricing: boolean('allows_coach_pricing').notNull().default(false),
  min_price_aed: integer('min_price_aed').notNull().default(0),
  min_price_egp: integer('min_price_egp').notNull().default(0),
  min_price_eur: integer('min_price_eur').notNull().default(0),
});

export type Services = typeof services.$inferSelect;
export type NewServices = typeof services.$inferInsert;
