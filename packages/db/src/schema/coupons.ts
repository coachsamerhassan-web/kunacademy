import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * coupons — Wave F.5 (migration 0060) — admin-created promo codes.
 *
 * Drizzle-typed as plain `text` for type/scope_kind/currency; CHECK constraints
 * in the DB enforce the allowed values. TS unions are narrowed in the
 * lib/discounts/ resolver.
 *
 * Locked decisions:
 *   F-W3 single-discount-wins  — enforced in lib/discounts/resolveBestDiscount
 *   F-W4 STFC + entrepreneurs  — enforced in resolveBestDiscount + apply-coupon
 *                                 unless `admin_override = true` on the coupon row
 */
export const coupons = pgTable(
  'coupons',
  {
    id:                      uuid('id').primaryKey().defaultRandom(),
    code:                    text('code').notNull().unique(),
    type:                    text('type').notNull(),                                // 'percentage' | 'fixed'
    value:                   integer('value').notNull(),                            // % (1..100) or cents
    currency:                text('currency'),                                      // 'AED'|'EGP'|'USD'|'EUR'|null
    redemptions_max:         integer('redemptions_max'),                            // null = unlimited
    redemptions_used:        integer('redemptions_used').notNull().default(0),
    valid_from:              timestamp('valid_from', { withTimezone: true, mode: 'string' }),
    valid_to:                timestamp('valid_to',   { withTimezone: true, mode: 'string' }),
    single_use_per_customer: boolean('single_use_per_customer').notNull().default(false),
    scope_kind:              text('scope_kind').notNull().default('all'),           // 'all' | 'programs' | 'tiers'
    scope_program_ids:       uuid('scope_program_ids').array().notNull().default([] as unknown as string[]),
    scope_tier_ids:          uuid('scope_tier_ids').array().notNull().default([] as unknown as string[]),
    admin_override:          boolean('admin_override').notNull().default(false),
    is_active:               boolean('is_active').notNull().default(true),
    description:             text('description'),
    created_by:              uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at:              timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updated_at:              timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    code_uidx:        uniqueIndex('coupons_code_uidx').on(t.code),
    active_idx:       index('coupons_active_idx').on(t.is_active),
    validity_idx:     index('coupons_validity_idx').on(t.valid_from, t.valid_to),
  })
);

export type Coupon    = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
