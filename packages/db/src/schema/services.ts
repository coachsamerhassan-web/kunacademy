import { pgTable, boolean, date, integer, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { service_categories } from './service_categories';
import { profiles } from './profiles';

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
  price_eur: integer("price_eur").default(0),
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
  // ── CMS→DB Phase 2a (migration 0031) ──────────────────────────────────
  /** Bundle reference — groups services sold together */
  bundle_id: text('bundle_id'),
  /** Discount percentage 0..100 (CHECK in DB) */
  discount_percentage: integer('discount_percentage'),
  /** Last valid date for the discount (ISO date) */
  discount_valid_until: date('discount_valid_until'),
  /** Whether this service/package can be paid in installments */
  installment_enabled: boolean('installment_enabled').notNull().default(false),
  /** Minimum kun level required to offer this service */
  coach_level_min: text('coach_level_min'),
  /** Exact kun level required (mutually exclusive with min) */
  coach_level_exact: text('coach_level_exact'),
  /** ICF credential target this service supports: ACC | PCC | MCC */
  icf_credential_target: text('icf_credential_target'),
  /** Pin service to a specific coach (null = any eligible coach) */
  coach_slug: text('coach_slug'),
  /** Sort key for public listings (lower = earlier) */
  display_order: integer('display_order').notNull().default(0),
  /** Convenience flag — free services (price_* may still be 0; this makes the intent explicit) */
  is_free: boolean('is_free').notNull().default(false),
  /** Restrict visibility to enrolled students only */
  student_only: boolean('student_only').notNull().default(false),
  /** Program slug this service/package is associated with (e.g. "manhajak") */
  program_slug: text('program_slug'),
  /** Published flag — controls public visibility independent of is_active operational state */
  published: boolean('published').notNull().default(true),
  /** Audit: last editor profile id */
  last_edited_by: uuid('last_edited_by').references(() => profiles.id),
  /** Audit: last-edit timestamp */
  last_edited_at: timestamp('last_edited_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Services = typeof services.$inferSelect;
export type NewServices = typeof services.$inferInsert;
