import { pgTable, text, timestamp, uuid, boolean, date } from 'drizzle-orm/pg-core';
import { communityMembers } from './community_members';

export const graduateCertificates = pgTable("graduate_certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  member_id: uuid("member_id").notNull().references(() => communityMembers.id, { onDelete: 'cascade' }),
  program_slug: text("program_slug").notNull(),
  program_name_ar: text("program_name_ar").notNull(),
  program_name_en: text("program_name_en").notNull(),
  certificate_type: text("certificate_type").notNull(),  // completion, level_1, level_2, level_3, level_4, specialization, mentorship
  cohort_name: text("cohort_name"),
  graduation_date: date("graduation_date").notNull(),
  icf_credential: text("icf_credential"),  // ACC, PCC, MCC
  icf_credential_date: date("icf_credential_date"),
  badge_slug: text("badge_slug").notNull(),
  badge_label_ar: text("badge_label_ar").notNull(),
  badge_label_en: text("badge_label_en").notNull(),
  verified: boolean("verified").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type GraduateCertificate = typeof graduateCertificates.$inferSelect;
export type NewGraduateCertificate = typeof graduateCertificates.$inferInsert;
