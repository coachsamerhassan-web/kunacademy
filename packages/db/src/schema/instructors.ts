import { pgTable, boolean, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const instructors = pgTable("instructors", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Phase 2b: FK hardened to ON DELETE SET NULL in migration 0032.
  profile_id: uuid("profile_id").references(() => profiles.id, { onDelete: 'set null' }),
  slug: text("slug").notNull(),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en").notNull(),
  /** Phase 2b: CMS TeamMember.name_ar / name_en (display name) */
  name_ar: text("name_ar"),
  name_en: text("name_en"),
  bio_ar: text("bio_ar"),
  bio_en: text("bio_en"),
  /** Phase 2b: Google Doc ID for rich bio (CMS TeamMember.bio_doc_id) */
  bio_doc_id: text("bio_doc_id"),
  photo_url: text("photo_url"),
  credentials: text("credentials"),
  /** Kun internal level: basic / professional / expert / master */
  kun_level: text("kun_level"),
  /** ICF credential: ACC / PCC / MCC */
  icf_credential: text("icf_credential"),
  /** Phase 2b: legacy CMS "coach_level" raw column (preserved for audit) */
  coach_level_legacy: text("coach_level_legacy"),
  /** Special service roles: mentor_coach, advanced_mentor */
  service_roles: text("service_roles").array(),
  specialties: text("specialties").array(),
  coaching_styles: text("coaching_styles").array(),
  development_types: text("development_types").array(),
  /** Phase 2b: CMS TeamMember.languages */
  languages: text("languages").array(),
  pricing_json: jsonb("pricing_json"),
  is_visible: boolean("is_visible").default(true),
  /** Phase 2b: CMS TeamMember.is_bookable */
  is_bookable: boolean("is_bookable").notNull().default(true),
  is_platform_coach: boolean("is_platform_coach").default(false),
  /** Phase 2b: CMS published flag (draft/editorial toggle) */
  published: boolean("published").notNull().default(true),
  display_order: integer("display_order").default(0),
  /** Phase 2b: audit — who last edited + when */
  last_edited_by: uuid("last_edited_by").references(() => profiles.id),
  last_edited_at: timestamp("last_edited_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export type Instructors = typeof instructors.$inferSelect;
export type NewInstructors = typeof instructors.$inferInsert;
