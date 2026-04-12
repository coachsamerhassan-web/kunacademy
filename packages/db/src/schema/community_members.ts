import { pgTable, text, timestamp, uuid, boolean, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const communityMembers = pgTable("community_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  profile_id: uuid("profile_id").references(() => profiles.id).unique(),  // nullable — null = no account
  student_number: text("student_number").unique(),  // e.g. STCE000001
  slug: text("slug").notNull().unique(),
  name_ar: text("name_ar").notNull(),
  name_en: text("name_en").notNull(),
  email: text("email"),
  phone: text("phone"),
  photo_url: text("photo_url"),
  bio_ar: text("bio_ar"),
  bio_en: text("bio_en"),
  country: text("country"),
  languages: text("languages").array(),
  member_type: text("member_type").notNull().default('alumni'),  // alumni, coach, both
  coaching_status: text("coaching_status"),  // active, inactive, in_training, null
  is_visible: boolean("is_visible").notNull().default(true),
  claimed_at: timestamp("claimed_at", { withTimezone: true, mode: 'string' }),
  source: text("source").notNull().default('manual'),  // sheet_import, crm_import, manual, self_registered
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type CommunityMember = typeof communityMembers.$inferSelect;
export type NewCommunityMember = typeof communityMembers.$inferInsert;
