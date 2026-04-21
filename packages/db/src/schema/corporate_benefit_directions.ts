import { pgTable, boolean, integer, text, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const corporate_benefits_mode = pgEnum('corporate_benefits_mode', ['list', 'all']);

export const corporate_benefit_directions = pgTable('corporate_benefit_directions', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  title_ar: text('title_ar').notNull(),
  title_en: text('title_en').notNull(),
  description_ar: text('description_ar'),
  description_en: text('description_en'),
  icon: text('icon'),
  benefits_mode: corporate_benefits_mode('benefits_mode').notNull().default('list'),
  display_order: integer('display_order').notNull().default(0),
  published: boolean('published').notNull().default(true),
  last_edited_by: uuid('last_edited_by').references(() => profiles.id),
  last_edited_at: timestamp('last_edited_at', { withTimezone: true, mode: 'string' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export type CorporateBenefitDirection = typeof corporate_benefit_directions.$inferSelect;
export type NewCorporateBenefitDirection = typeof corporate_benefit_directions.$inferInsert;
