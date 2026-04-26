import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';
import { tiers } from './tiers';

/**
 * memberships — Wave F.1 (migration 0055) — user subscription state.
 *
 * Invariant: ONE non-ended membership per user.
 * Enforced via partial unique index memberships_user_active_uidx
 * (WHERE ended_at IS NULL AND status IN ('active','past_due','paused','trialing')).
 *
 * Upgrade flow mutates in place — tier_id + status update, started_at preserved
 * as member-age timestamp.
 */
export const memberships = pgTable(
  'memberships',
  {
    id:                      uuid('id').primaryKey().defaultRandom(),
    user_id:                 uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    tier_id:                 uuid('tier_id').notNull().references(() => tiers.id),
    status:                  text('status').notNull().default('active'),
    billing_frequency:       text('billing_frequency'),
    stripe_customer_id:      text('stripe_customer_id'),
    stripe_subscription_id:  text('stripe_subscription_id'),
    started_at:              timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    current_period_start:    timestamp('current_period_start', { withTimezone: true, mode: 'string' }),
    current_period_end:      timestamp('current_period_end', { withTimezone: true, mode: 'string' }),
    cancel_at:               timestamp('cancel_at', { withTimezone: true, mode: 'string' }),
    cancelled_at:            timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
    ended_at:                timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    /** Wave F.6 — optional reason supplied by member at cancel; used by win-back filter. */
    cancel_reason:           text('cancel_reason'),
    metadata:                jsonb('metadata'),
    created_at:              timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updated_at:              timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    user_idx:         index('memberships_user_idx').on(t.user_id),
    user_active_uidx: uniqueIndex('memberships_user_active_uidx').on(t.user_id),
    tier_status_idx:  index('memberships_tier_status_idx').on(t.tier_id, t.status),
    stripe_sub_idx:   index('memberships_stripe_sub_idx').on(t.stripe_subscription_id),
    cancel_at_idx:    index('memberships_cancel_at_idx').on(t.cancel_at),
  })
);

export type Membership    = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
