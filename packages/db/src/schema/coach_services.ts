import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { providers } from './providers';
import { services } from './services';

export const coach_services = pgTable('coach_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider_id: uuid('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  service_id: uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  is_active: boolean('is_active').notNull().default(true),
  assigned_by: text('assigned_by').notNull().default('auto'),
  custom_price_aed: integer('custom_price_aed'),
  custom_price_egp: integer('custom_price_egp'),
  custom_price_eur: integer('custom_price_eur'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export type CoachServices = typeof coach_services.$inferSelect;
export type NewCoachServices = typeof coach_services.$inferInsert;
