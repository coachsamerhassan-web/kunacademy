import { pgTable, integer, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const earnings = pgTable("earnings", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  source_type: text("source_type").notNull(),
  source_id: uuid("source_id"),
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
