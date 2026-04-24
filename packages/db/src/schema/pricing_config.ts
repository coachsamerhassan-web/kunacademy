import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * pricing_config — Wave F.1 (migration 0055).
 *
 * Admin-editable misc prices (coach rates, Samer 1:1, program discount %, etc.)
 * unified pricing dashboard reads from tiers + programs.price_* + this table.
 *
 * UNIQUE (entity_type, entity_key, currency) — exactly one row per price point.
 * currency may be NULL for percentage-type values.
 *
 * For percentages, value_cents is (percent × 100) — e.g. 1000 = 10.00%,
 * 1500 = 15.00%. This keeps all value_cents as integer minor units regardless
 * of whether it's currency or percentage.
 */
export const pricing_config = pgTable(
  'pricing_config',
  {
    id:           uuid('id').primaryKey().defaultRandom(),
    entity_type:  text('entity_type').notNull(),
    entity_key:   text('entity_key').notNull(),
    value_cents:  integer('value_cents'),
    currency:     text('currency'),
    updated_by:   uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
    updated_at:   timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    created_at:   timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    entity_idx: index('pricing_config_entity_idx').on(t.entity_type),
  })
);

export type PricingConfig    = typeof pricing_config.$inferSelect;
export type NewPricingConfig = typeof pricing_config.$inferInsert;

/**
 * pricing_config_audit — append-only audit trail for pricing changes.
 *
 * Per Q1 (Samer 2026-04-24): every price change must record who changed what
 * when. Application-layer audit (not trigger) so change_reason UX field
 * and changed_by session-user can be captured.
 */
export const pricing_config_audit = pgTable(
  'pricing_config_audit',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    entity_type:      text('entity_type').notNull(),
    entity_key:       text('entity_key').notNull(),
    old_value_cents:  integer('old_value_cents'),
    new_value_cents:  integer('new_value_cents'),
    changed_by:       uuid('changed_by').references(() => profiles.id, { onDelete: 'set null' }),
    changed_at:       timestamp('changed_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    reason:           text('reason'),
  },
  (t) => ({
    entity_idx:     index('pricing_config_audit_entity_idx').on(t.entity_type, t.entity_key, t.changed_at),
    changed_by_idx: index('pricing_config_audit_changed_by_idx').on(t.changed_by, t.changed_at),
  })
);

export type PricingConfigAudit    = typeof pricing_config_audit.$inferSelect;
export type NewPricingConfigAudit = typeof pricing_config_audit.$inferInsert;
