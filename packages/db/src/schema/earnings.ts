import { pgTable, integer, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const earnings = pgTable("earnings", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  source_type: text("source_type").notNull(),
  // source_id: generic FK — booking_id for service_booking, payment_id for all others.
  // payment_id below is the explicit FK to payments for audit trail (added Wave S0 Block C Phase 4 #13).
  source_id: uuid("source_id"),
  // payment_id: explicit FK to payments table for audit trail + idempotency checks.
  // ADD COLUMN IF NOT EXISTS in migration (see migration note below).
  payment_id: uuid("payment_id"),
  // referrer_id: forward-compatible for S7 promo/referral spec.
  // ADD COLUMN IF NOT EXISTS in migration.
  referrer_id: uuid("referrer_id"),
  gross_amount: integer("gross_amount").notNull(),
  commission_pct: numeric("commission_pct").notNull(),
  commission_amount: integer("commission_amount").notNull(),
  net_amount: integer("net_amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").default('pending'),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  available_at: timestamp("available_at", { withTimezone: true, mode: 'string' }),
});

export type Earnings = typeof earnings.$inferSelect;
export type NewEarnings = typeof earnings.$inferInsert;
