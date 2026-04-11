import { pgTable, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  order_id: uuid("order_id"),
  booking_id: uuid("booking_id"),
  // event_registration_id: nullable FK to event_registrations.id — enables the settlement
  // webhook to locate the correct registration when an event deposit or balance payment lands.
  // We do NOT use a hard FK reference here (avoids circular dependency with event_registrations
  // which already references payments.id). Integrity is enforced by the application layer.
  event_registration_id: uuid("event_registration_id"),
  gateway: text("gateway"),
  gateway_payment_id: text("gateway_payment_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").default('pending'),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type Payments = typeof payments.$inferSelect;
export type NewPayments = typeof payments.$inferInsert;
