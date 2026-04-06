import { pgTable, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const payout_requests = pgTable("payout_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").default('requested'),
  processed_by: uuid("processed_by").references(() => profiles.id),
  processed_at: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
  payment_method: text("payment_method"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  bank_details: jsonb("bank_details"),
  admin_note: text("admin_note"),
});

export type PayoutRequests = typeof payout_requests.$inferSelect;
export type NewPayoutRequests = typeof payout_requests.$inferInsert;
