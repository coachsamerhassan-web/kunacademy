import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { providers } from './providers';

export const discount_codes = pgTable('discount_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  discount_type: text('discount_type').notNull().default('percentage'),
  discount_value: integer('discount_value').notNull(),
  currency: text('currency'),
  valid_from: timestamp('valid_from', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  valid_until: timestamp('valid_until', { withTimezone: true, mode: 'string' }).notNull(),
  max_uses: integer('max_uses'),
  current_uses: integer('current_uses').notNull().default(0),
  pending_uses: integer('pending_uses').notNull().default(0),
  applicable_service_ids: text('applicable_service_ids').array(),
  provider_id: uuid('provider_id').references(() => providers.id, { onDelete: 'set null' }),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export type DiscountCodes = typeof discount_codes.$inferSelect;
export type NewDiscountCodes = typeof discount_codes.$inferInsert;
