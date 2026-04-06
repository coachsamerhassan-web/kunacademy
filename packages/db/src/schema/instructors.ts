import { pgTable, boolean, integer, jsonb, text, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const instructors = pgTable("instructors", {
  id: uuid("id").primaryKey().defaultRandom(),
  profile_id: uuid("profile_id").references(() => profiles.id),
  slug: text("slug").notNull(),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en").notNull(),
  bio_ar: text("bio_ar"),
  bio_en: text("bio_en"),
  photo_url: text("photo_url"),
  credentials: text("credentials"),
  /** @deprecated Kept for backward compat. Use icf_credential + kun_level instead. */
  coach_level: text("coach_level"),
  /** Kun internal level: basic / professional / expert / master */
  kun_level: text("kun_level"),
  /** ICF credential: ACC / PCC / MCC */
  icf_credential: text("icf_credential"),
  /** Special service roles: mentor_coach, advanced_mentor */
  service_roles: text("service_roles").array(),
  specialties: text("specialties").array(),
  coaching_styles: text("coaching_styles").array(),
  development_types: text("development_types").array(),
  pricing_json: jsonb("pricing_json"),
  is_visible: boolean("is_visible").default(true),
  is_platform_coach: boolean("is_platform_coach").default(false),
  display_order: integer("display_order").default(0),
});

export type Instructors = typeof instructors.$inferSelect;
export type NewInstructors = typeof instructors.$inferInsert;
