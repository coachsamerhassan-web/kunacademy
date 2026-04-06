import { pgTable, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const credit_transactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  source_type: text("source_type"),
  source_id: uuid("source_id"),
  balance_after: integer("balance_after").notNull(),
  note: text("note"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CreditTransactions = typeof credit_transactions.$inferSelect;
export type NewCreditTransactions = typeof credit_transactions.$inferInsert;
