import { pgTable, boolean, jsonb, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { landing_pages } from './landing_pages';

/**
 * Wave 14 LP-INFRA (migration 0052) — lp_leads
 *
 * Audit trail for landing-page lead submissions. Written BEFORE the Zoho /
 * email / Telegram fan-out fires, so a lead is never lost even if downstream
 * services are unavailable.
 *
 * Admin-read, app-insert. anon explicitly blocked at RLS layer (insertion
 * happens via the API route handler running as `kunacademy` role).
 */
export const lp_leads = pgTable('lp_leads', {
  id:               uuid('id').primaryKey().defaultRandom(),
  landing_page_id:  uuid('landing_page_id').notNull().references(() => landing_pages.id, { onDelete: 'cascade' }),
  slug:             text('slug').notNull(),
  locale:           text('locale').notNull(),
  name:             text('name').notNull(),
  email:            text('email').notNull(),
  phone:            text('phone'),
  message:          text('message'),
  metadata:         jsonb('metadata'),
  zoho_synced:      boolean('zoho_synced').notNull().default(false),
  zoho_synced_at:   timestamp('zoho_synced_at', { withTimezone: true, mode: 'string' }),
  zoho_contact_id:  text('zoho_contact_id'),
  ip_address:       text('ip_address'),
  user_agent:       text('user_agent'),
  utm_source:       text('utm_source'),
  utm_medium:       text('utm_medium'),
  utm_campaign:     text('utm_campaign'),
  created_at:       timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  slugCreatedIdx:    index('idx_lp_leads_slug_created').on(t.slug, t.created_at),
  emailLowerIdx:     index('idx_lp_leads_email_lower').on(t.email),
  landingPageIdx:    index('idx_lp_leads_landing_page').on(t.landing_page_id, t.created_at),
  createdAtIdx:      index('idx_lp_leads_created_at').on(t.created_at),
}));

export type LpLead = typeof lp_leads.$inferSelect;
export type NewLpLead = typeof lp_leads.$inferInsert;
