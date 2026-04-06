import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { enrollments } from './enrollments';
import { profiles } from './profiles';

export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  enrollment_id: uuid("enrollment_id").notNull().references(() => enrollments.id),
  template_id: text("template_id"),
  credential_type: text("credential_type"),
  issued_at: timestamp("issued_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  pdf_url: text("pdf_url"),
  verification_code: text("verification_code"),
});

export type Certificates = typeof certificates.$inferSelect;
export type NewCertificates = typeof certificates.$inferInsert;
