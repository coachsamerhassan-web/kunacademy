import { pgTable, boolean, integer, text, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';
import { corporate_benefit_directions } from './corporate_benefit_directions';

export const corporate_roi_category = pgEnum('corporate_roi_category', [
  'productivity',
  'turnover',
  'absenteeism',
  'engagement',
  'conflict',
]);

export const corporate_benefits = pgTable('corporate_benefits', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  direction_slug: text('direction_slug')
    .notNull()
    .references(() => corporate_benefit_directions.slug, { onUpdate: 'cascade', onDelete: 'restrict' }),
  label_ar: text('label_ar').notNull(),
  label_en: text('label_en').notNull(),
  description_ar: text('description_ar'),
  description_en: text('description_en'),
  citation_ar: text('citation_ar'),
  citation_en: text('citation_en'),
  benchmark_improvement_pct: integer('benchmark_improvement_pct').notNull().default(0),
  roi_category: corporate_roi_category('roi_category').notNull().default('productivity'),
  self_assessment_prompt_ar: text('self_assessment_prompt_ar'),
  self_assessment_prompt_en: text('self_assessment_prompt_en'),
  display_order: integer('display_order').notNull().default(0),
  published: boolean('published').notNull().default(true),
  last_edited_by: uuid('last_edited_by').references(() => profiles.id),
  last_edited_at: timestamp('last_edited_at', { withTimezone: true, mode: 'string' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export type CorporateBenefit = typeof corporate_benefits.$inferSelect;
export type NewCorporateBenefit = typeof corporate_benefits.$inferInsert;
