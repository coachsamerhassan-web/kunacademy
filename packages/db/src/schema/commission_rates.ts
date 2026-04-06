import { pgTable, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const commission_rates = pgTable("commission_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope").notNull(),
  scope_id: text("scope_id"),
  category: text("category").notNull(),
  rate_pct: numeric("rate_pct").notNull(),
  created_by: uuid("created_by").references(() => profiles.id),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CommissionRates = typeof commission_rates.$inferSelect;
export type NewCommissionRates = typeof commission_rates.$inferInsert;
