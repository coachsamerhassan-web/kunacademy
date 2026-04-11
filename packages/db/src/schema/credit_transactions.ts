import { pgTable, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const credit_transactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  // amount: positive integer in minor units (cents/fils/piastres).
  // Positive = credit earned. Use type to determine direction.
  amount: integer("amount").notNull(),
  // type: 'earn' | 'spend' | 'payout' | 'referral_credit' (referral_credit = earn variant)
  type: text("type").notNull(),
  // source_type: 'referral' | 'referral_credit' | 'checkout' | 'refund' | 'admin_adjustment'
  source_type: text("source_type"),
  source_id: uuid("source_id"),
  // currency: ISO code (lowercase). Defaults to 'aed' for backward compatibility with
  // existing rows that were written before this column was added (Wave S0 #13).
  // ADD COLUMN IF NOT EXISTS DEFAULT 'aed' in migration.
  currency: text("currency").default('aed'),
  balance_after: integer("balance_after").notNull(),
  note: text("note"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CreditTransactions = typeof credit_transactions.$inferSelect;
export type NewCreditTransactions = typeof credit_transactions.$inferInsert;
