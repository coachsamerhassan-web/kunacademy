import { pgTable, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const pathfinder_responses = pgTable("pathfinder_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  type: text("type").notNull(),
  answers_json: jsonb("answers_json").notNull(),
  recommendations: jsonb("recommendations").notNull(),
  roi_inputs: jsonb("roi_inputs"),
  journey_stage: text("journey_stage"),
  locale: text("locale").default('ar'),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  direction: text("direction"),
  selected_benefits: jsonb("selected_benefits"),
  self_assessment: jsonb("self_assessment"),
  custom_benefits: text("custom_benefits").array(),
  proposal_pdf_url: text("proposal_pdf_url"),
  job_title: text("job_title"),
});

export type PathfinderResponses = typeof pathfinder_responses.$inferSelect;
export type NewPathfinderResponses = typeof pathfinder_responses.$inferInsert;
