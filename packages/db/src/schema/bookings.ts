import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { payments } from './payments';
import { profiles } from './profiles';
import { providers } from './providers';
import { services } from './services';

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  service_id: uuid("service_id").references(() => services.id),
  provider_id: uuid("provider_id").references(() => providers.id),
  // Nullable — guest bookings have no account yet; filled in after guest-signup
  customer_id: uuid("customer_id").references(() => profiles.id),
  start_time: timestamp("start_time", { withTimezone: true, mode: 'string' }).notNull(),
  end_time: timestamp("end_time", { withTimezone: true, mode: 'string' }).notNull(),
  status: text("status").default('pending'),
  payment_id: uuid("payment_id").references(() => payments.id),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  coach_id: uuid("coach_id").references(() => profiles.id),
  meeting_url: text("meeting_url"),
  cancelled_at: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
  cancellation_reason: text("cancellation_reason"),
  held_until: timestamp("held_until", { withTimezone: true, mode: 'string' }),
  held_by: uuid("held_by"),
  calendar_event_id: text("calendar_event_id"),
  // Guest booking fields — populated when user books without an account
  guest_name: text("guest_name"),
  guest_email: text("guest_email"),
  guest_phone: text("guest_phone"),
});

export type Bookings = typeof bookings.$inferSelect;
export type NewBookings = typeof bookings.$inferInsert;
