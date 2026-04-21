import {
  pgTable,
  boolean,
  text,
  timestamp,
  uuid,
  integer,
  date,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * CMS→DB Phase 2e — events table.
 *
 * Replaces the CMS `events` sheet (`apps/web/data/cms/events.json`).
 * See migration 0038_cms_phase2e_events.sql for DDL + CHECKs + RLS.
 *
 * `location_type`, `status` are enforced at the DB via CHECK.
 * Drizzle types them as plain `text` — the CMS `Event` type in
 * packages/cms/src/types.ts carries the narrow TypeScript unions
 * (`'in-person' | 'online' | 'hybrid'` and `'open' | 'sold_out' | 'completed'`).
 */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),

    // Bilingual identity
    title_ar: text('title_ar').notNull(),
    title_en: text('title_en').notNull(),
    description_ar: text('description_ar'),
    description_en: text('description_en'),

    // Dates (day resolution — matches CMS JSON source shape)
    date_start: date('date_start').notNull(),
    date_end: date('date_end'),

    // Location
    location_ar: text('location_ar'),
    location_en: text('location_en'),
    location_type: text('location_type').notNull().default('online'),

    // Capacity + pricing (Events uses AED/EGP/USD only — no EUR)
    capacity: integer('capacity'),
    price_aed: numeric('price_aed', { precision: 10, scale: 2 }).notNull().default('0'),
    price_egp: numeric('price_egp', { precision: 10, scale: 2 }).notNull().default('0'),
    price_usd: numeric('price_usd', { precision: 10, scale: 2 }).notNull().default('0'),

    // Visual
    image_url: text('image_url'),
    promo_video_url: text('promo_video_url'),

    // Cross-refs (loose text — programs.slug / instructors.slug CMS pattern)
    program_slug: text('program_slug'),
    speaker_slugs: text('speaker_slugs').array().notNull().default([]),

    // Registration
    registration_url: text('registration_url'),
    registration_deadline: date('registration_deadline'),
    status: text('status').notNull().default('open'),

    // Flags + ordering
    is_featured: boolean('is_featured').notNull().default(false),
    display_order: integer('display_order').notNull().default(0),

    // Lifecycle
    published: boolean('published').notNull().default(true),
    published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),

    last_edited_by: uuid('last_edited_by').references(() => profiles.id),
    last_edited_at: timestamp('last_edited_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugUidx: uniqueIndex('events_slug_uidx').on(t.slug),
    dateStartIdx: index('events_date_start_idx').on(t.date_start),
    publishedIdx: index('events_published_idx').on(t.published),
    programSlugIdx: index('events_program_slug_idx').on(t.program_slug),
    statusIdx: index('events_status_idx').on(t.status),
    displayOrderIdx: index('events_display_order_idx').on(t.display_order),
    isFeaturedIdx: index('events_is_featured_idx').on(t.is_featured),
  }),
);

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
