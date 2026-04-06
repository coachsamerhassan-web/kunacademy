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
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export type EventRegistrations = typeof event_registrations.$inferSelect;
export type NewEventRegistrations = typeof event_registrations.$inferInsert;
