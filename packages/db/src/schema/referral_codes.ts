import { pgTable, boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const referral_codes = pgTable("referral_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profiles.id),
  code: text("code").notNull(),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type ReferralCodes = typeof referral_codes.$inferSelect;
export type NewReferralCodes = typeof referral_codes.$inferInsert;
