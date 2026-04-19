import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  full_name_ar: text("full_name_ar"),
  full_name_en: text("full_name_en"),
  phone: text("phone"),
  country: text("country"),
  role: text("role").default('student'),
  avatar_url: text("avatar_url"),
  preferred_language: text("preferred_language").default('ar'),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type Profiles = typeof profiles.$inferSelect;
export type NewProfiles = typeof profiles.$inferInsert;
