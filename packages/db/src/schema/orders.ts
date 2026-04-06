import { pgTable, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { payments } from './payments';
import { profiles } from './profiles';

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customer_id: uuid("customer_id").notNull().references(() => profiles.id),
  status: text("status").default('pending'),
  total_amount: integer("total_amount").notNull(),
  currency: text("currency").notNull(),
  payment_gateway: text("payment_gateway"),
  payment_id: uuid("payment_id").references(() => payments.id),
  shipping_address: jsonb("shipping_address"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type Orders = typeof orders.$inferSelect;
export type NewOrders = typeof orders.$inferInsert;
