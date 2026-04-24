import {
  pgTable,
  boolean,
  text,
  timestamp,
  uuid,
  integer,
  index,
} from 'drizzle-orm/pg-core';

/**
 * tiers — Wave F.1 (migration 0055) — subscription tier config.
 *
 * Drizzle-typed as plain `text` for slug/currency; CHECK constraints
 * in the DB enforce the allowed values. TS union narrowing happens in
 * the membership service layer.
 *
 * Stripe Price IDs are NULL at seed; Wave F.2 provisioning populates them.
 */
export const tiers = pgTable(
  'tiers',
  {
    id:                       uuid('id').primaryKey().defaultRandom(),
    slug:                     text('slug').notNull().unique(),
    name_ar:                  text('name_ar').notNull(),
    name_en:                  text('name_en').notNull(),
    description_ar:           text('description_ar'),
    description_en:           text('description_en'),
    price_monthly_cents:      integer('price_monthly_cents').notNull().default(0),
    price_annual_cents:       integer('price_annual_cents').notNull().default(0),
    currency:                 text('currency').notNull().default('AED'),
    stripe_product_id:        text('stripe_product_id'),
    stripe_price_id_monthly:  text('stripe_price_id_monthly'),
    stripe_price_id_annual:   text('stripe_price_id_annual'),
    sort_order:               integer('sort_order').notNull().default(0),
    is_public:                boolean('is_public').notNull().default(true),
    is_active:                boolean('is_active').notNull().default(true),
    created_at:               timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updated_at:               timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    active_public_idx: index('tiers_active_public_idx').on(t.is_active, t.is_public),
    sort_order_idx:    index('tiers_sort_order_idx').on(t.sort_order),
  })
);

export type Tier    = typeof tiers.$inferSelect;
export type NewTier = typeof tiers.$inferInsert;
