import { pgTable, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { payments } from './payments';
import { profiles } from './profiles';

export const payment_schedules = pgTable("payment_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  payment_id: uuid("payment_id").notNull().references(() => payments.id),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  total_amount: integer("total_amount").notNull(),
  paid_amount: integer("paid_amount").default(0),
  remaining_amount: integer("remaining_amount").notNull(),
  schedule_type: text("schedule_type").notNull(),
  installments: jsonb("installments").notNull(),
  currency: text("currency").notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type PaymentSchedules = typeof payment_schedules.$inferSelect;
export type NewPaymentSchedules = typeof payment_schedules.$inferInsert;
