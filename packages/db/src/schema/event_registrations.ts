import { pgTable, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { payments } from './payments';

export const event_registrations = pgTable("event_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id"),
  event_slug: text("event_slug").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: text("status").default('registered').notNull(),
  payment_id: uuid("payment_id").references(() => payments.id),
  seats: integer("seats").default(1),
  notes: text("notes"),
  // ── Deposit tracking (added Wave S0 Block C Phase 4) ─────────────────────
  // deposit_amount: what the student paid as the initial deposit, in minor units.
  // Null means this registration was paid in full (no deposit flow used).
  deposit_amount: integer("deposit_amount"),
  // deposit_paid_at: timestamp when the deposit payment was confirmed by the webhook.
  deposit_paid_at: timestamp("deposit_paid_at", { withTimezone: true, mode: 'string' }),
  // balance_amount: what remains to be paid after the deposit, in minor units.
  balance_amount: integer("balance_amount"),
  // balance_due_date: computed at registration time as (event_date - balance_due_days_before_event).
  // Stored as a snapshot so reminder cron does not need to re-derive it.
  balance_due_date: timestamp("balance_due_date", { withTimezone: true, mode: 'string' }),
  // balance_paid_at: timestamp when the balance payment_schedule was settled.
  balance_paid_at: timestamp("balance_paid_at", { withTimezone: true, mode: 'string' }),
  // deposit_percentage: the percentage used at registration time, snapshotted from the CMS event config.
  // Stored here so re-calculations remain consistent even if the CMS value changes later.
  deposit_percentage: integer("deposit_percentage"),
  // balance_due_days_before_event: snapshotted from the CMS event config at registration time.
  balance_due_days_before_event: integer("balance_due_days_before_event"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export type EventRegistrations = typeof event_registrations.$inferSelect;
export type NewEventRegistrations = typeof event_registrations.$inferInsert;
