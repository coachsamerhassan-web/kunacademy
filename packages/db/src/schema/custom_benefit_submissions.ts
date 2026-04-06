import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pathfinder_responses } from './pathfinder_responses';

export const custom_benefit_submissions = pgTable("custom_benefit_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  pathfinder_response_id: uuid("pathfinder_response_id").references(() => pathfinder_responses.id),
  direction: text("direction").notNull(),
  benefit_text: text("benefit_text").notNull(),
  company_context: text("company_context"),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export type CustomBenefitSubmissions = typeof custom_benefit_submissions.$inferSelect;
export type NewCustomBenefitSubmissions = typeof custom_benefit_submissions.$inferInsert;
