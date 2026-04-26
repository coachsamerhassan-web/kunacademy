import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';
import { orders } from './orders';
import { coupons } from './coupons';

/**
 * coupon_redemptions — Wave F.5 (migration 0060) — append-only redemption log.
 *
 * Single-use-per-customer is enforced via a partial unique index on
 * (coupon_id, customer_id) WHERE customer_id IS NOT NULL — Postgres
 * serializes index inserts so the race-condition is closed at the DB,
 * not at the application layer. The library handles the friendly
 * error mapping (already_used).
 */
export const coupon_redemptions = pgTable(
  'coupon_redemptions',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    coupon_id:      uuid('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
    customer_id:    uuid('customer_id').references(() => profiles.id, { onDelete: 'set null' }),
    order_id:       uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    amount_applied: integer('amount_applied').notNull(),                              // minor units
    currency:       text('currency').notNull(),                                       // 'AED'|'EGP'|'USD'|'EUR'
    redeemed_at:    timestamp('redeemed_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    single_use_uidx: uniqueIndex('coupon_redemptions_single_use_uidx').on(t.coupon_id, t.customer_id),
    coupon_idx:      index('coupon_redemptions_coupon_idx').on(t.coupon_id, t.redeemed_at),
    customer_idx:    index('coupon_redemptions_customer_idx').on(t.customer_id, t.redeemed_at),
    order_idx:       index('coupon_redemptions_order_idx').on(t.order_id),
  })
);

export type CouponRedemption    = typeof coupon_redemptions.$inferSelect;
export type NewCouponRedemption = typeof coupon_redemptions.$inferInsert;
