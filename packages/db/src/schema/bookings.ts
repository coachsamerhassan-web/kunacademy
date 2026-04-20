import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';
import { payments } from './payments';
import { profiles } from './profiles';
import { providers } from './providers';
import { services } from './services';
import { discount_codes } from './discount_codes';

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
  // Guest token (P0-#7) — nullable, unique, used for stateless guest session retrieval
  guest_token: text("guest_token").unique(),
  guest_token_expires_at: timestamp("guest_token_expires_at", { withTimezone: true, mode: 'string' }),
  // Server-side discount (P0-#8) — nullable FK to discount_codes
  discount_code_id: uuid("discount_code_id").references(() => discount_codes.id, { onDelete: 'set null' }),
  // Final amount in cents; null means use service.price_aed (default)
  final_amount_aed: integer("final_amount_aed"),
  final_amount_egp: integer("final_amount_egp"),
  final_amount_usd: integer("final_amount_usd"),
  // Which currency is authoritative (aed|egp|usd); null means use service default
  final_amount_currency: text("final_amount_currency"),
  // Session completion signal (Wave S9) — explicit, coach-triggered, not time-inferred
  session_completed_at:     timestamp("session_completed_at", { withTimezone: true, mode: 'string' }),
  session_completed_by:     uuid("session_completed_by").references(() => profiles.id),
  session_completion_notes: text("session_completion_notes"),
});

export type Bookings = typeof bookings.$inferSelect;
export type NewBookings = typeof bookings.$inferInsert;
