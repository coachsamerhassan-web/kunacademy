import { pgTable, boolean, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const coach_integrations = pgTable("coach_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  coach_id: uuid("coach_id").notNull().references(() => profiles.id),
  provider: text("provider").notNull(),
  access_token: text("access_token"),
  refresh_token: text("refresh_token"),
  token_expires_at: timestamp("token_expires_at", { withTimezone: true, mode: 'string' }),
  calendar_id: text("calendar_id").default('primary'),
  is_active: boolean("is_active").default(true),
  connected_at: timestamp("connected_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => ({
  unique_coach_provider: unique("coach_integrations_coach_id_provider_unique").on(table.coach_id, table.provider),
}));

export type CoachIntegrations = typeof coach_integrations.$inferSelect;
export type NewCoachIntegrations = typeof coach_integrations.$inferInsert;
